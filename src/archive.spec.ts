// tslint:disable:completed-docs

import {
	ensureDir as fseEnsureDir,
	remove as fseRemove
} from 'fs-extra';
import {
	platform as osPlatform
} from 'os';
import {join as pathJoin} from 'path';
import {
	Duplex,
	Readable
} from 'stream';

import {
	Archive,
	Entry,
	IEntryInfo
} from './archive';
import {
	PathType
} from './types';
import {
	fsLstat,
	modePermissionBits,
	pathResourceFork,
	zipPathIsMacResource
} from './util';

export const specTmpPath = pathJoin('spec', 'tmp');
export const specTmpArchivePath = pathJoin(specTmpPath, 'archive');
export const specTmpExtractPath = pathJoin(specTmpPath, 'extract');
export const specFixturesPath = pathJoin('spec', 'fixtures');

function bufferToStream(buffer: Buffer) {
	const stream = new Duplex();
	stream.push(buffer);
	stream.push(null);
	return stream as Readable;
}

export const platform = osPlatform();
export const platformIsMac = platform === 'darwin';
export const platformIsWin = platform === 'win32';

const testEntries = [
	{
		type: PathType.FILE,
		pathRaw: 'file.txt',
		size: 8,
		readData: async () => bufferToStream(Buffer.from('foo bar\n'))
	},
	{
		type: PathType.DIRECTORY,
		pathRaw: 'directory'
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'symlink',
		readSymlink: async () => 'target'
	},
	{
		type: PathType.FILE,
		pathRaw: 'directory/subfile.txt',
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'unknown/orphaned.txt',
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'nonexecutable.txt',
		mode: 0o644,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		readData: async () => bufferToStream(Buffer.from(
			'#!/bin/sh\necho nonexecutable\n'
		))
	},
	{
		type: PathType.FILE,
		pathRaw: 'executable.sh',
		mode: 0o755,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		readData: async () => bufferToStream(Buffer.from(
			'#!/bin/sh\necho executable\n'
		))
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'nonexecutable-link',
		mode: 0o644,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		readSymlink: async () => 'target'
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'executable-link',
		mode: 0o755,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		readSymlink: async () => 'target'
	},
	{
		type: PathType.DIRECTORY,
		pathRaw: 'dir-owner',
		mode: 0o700,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24')
	},
	{
		type: PathType.FILE,
		pathRaw: 'dir-owner/sub.txt',
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.DIRECTORY,
		pathRaw: 'dir-group',
		mode: 0o770,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24')
	},
	{
		type: PathType.FILE,
		pathRaw: 'dir-group/sub.txt',
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'rsrc-content.bin',
		size: 4,
		readData: async () => bufferToStream(Buffer.from('data')),
	},
	platformIsMac ? {
		type: PathType.RESOURCE_FORK,
		pathRaw: 'rsrc-content.bin',
		size: 9,
		readRsrc: async () => bufferToStream(Buffer.from('rsrc fork'))
	} : null
];

export class EntryTest extends Entry {
	constructor(info: IEntryInfo) {
		super(info);
	}
}

export class ArchiveTest extends Archive {
	public readonly Entry = EntryTest;

	constructor(path: string) {
		super(path);
	}

	public async read(itter: (entry: EntryTest) => Promise<any>) {
		await super.read(itter);
	}

	protected async _read(itter: (entry: EntryTest) => Promise<any>) {
		for (const info of testEntries) {
			if (!info) {
				continue;
			}
			const entry = new this.Entry({archive: this, ...info});
			const ret = await entry.trigger(itter);
			if (ret === false) {
				break;
			}
		}
	}
}

export function testArchive(
	ArchiveConstructor: new(path: string) => Archive,
	paths: string[] | null,
	setup: (() => Promise<any>) | null = null
) {
	if (!paths) {
		it('no supported paths', async () => {
			expect(true).toBe(true);
		});
		return;
	}

	beforeEach(async () => {
		await fseRemove(specTmpPath);
		await fseEnsureDir(specTmpPath);

		if (setup) {
			await setup();
		}
	});

	afterEach(async () => {
		await fseRemove(specTmpPath);
	});

	for (const path of paths) {
		describe(path, () => {
			describe('read', () => {
				it('extract', async () => {
					const archive = new ArchiveConstructor(path);

					const entries: Entry[] = [];
					await archive.read(async entry => {
						expect(zipPathIsMacResource(entry.path)).toBe(false);

						entries.push(entry);
						const dest = pathJoin(specTmpExtractPath, entry.path);
						await entry.extract(dest);
					});

					expect(entries.length).toBeGreaterThan(1);

					for (const entry of entries) {
						const dest = pathJoin(specTmpExtractPath, entry.path);
						const stat = await fsLstat(dest);

						const {type, size, mode, atime, mtime} = entry;

						// No good way to test atime.
						// File indexing and AV scanning can change it.
						// Just test mtime instead.
						const setMtime = mtime || atime;

						if (size !== null) {
							if (
								type === PathType.FILE ||
								type === PathType.SYMLINK
							) {
								expect(stat.size).toBe(size);
							}
							else if (type === PathType.RESOURCE_FORK) {
								const destRsrc = pathResourceFork(dest);
								const statRsrc = await fsLstat(destRsrc);
								expect(statRsrc.size).toBe(size);
							}
						}

						if (setMtime) {
							expect(stat.mtime.toISOString())
								.toBe(setMtime.toISOString());
						}

						if (!platformIsWin && mode !== null) {
							expect(modePermissionBits(stat.mode))
								.toBe(modePermissionBits(mode));
						}
					}
				});

				it('cancel', async () => {
					const archive = new ArchiveConstructor(path);

					let count = 0;
					await archive.read(async info => {
						count++;
						return false;
					});

					expect(count).toBe(1);
				});
			});
		});
	}
}

describe('archive', () => {
	describe('Archive', () => {
		testArchive(
			ArchiveTest,
			['dummy.file']
		);
	});
});
