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
	fsLchmodSupported,
	fsLstat,
	fsLutimesSupported,
	modePermissionBits,
	pathResourceFork,
	streamToBuffer,
	zipPathIsMacResource
} from './util';

// An option to disable mtime testing (for a CI that has issues).
// For Travis on Windows, which randomly fails to have the correct mtime.
export const disableMtimeTesting =
	process.env.ARCHIVE_FILES_DISABLE_MTIME_TESTING === '1';

export const specTmpPath = pathJoin('spec', 'tmp');
export const specTmpArchivePath = pathJoin(specTmpPath, 'archive');
export const specTmpExtractPath = pathJoin(specTmpPath, 'extract');
export const specFixturesPath = pathJoin('spec', 'fixtures');

export const mtimePrecisionMax = 2000;

export const platform = osPlatform();
export const platformIsMac = platform === 'darwin';
export const platformIsWin = (
	platform === 'win32' ||
	(platform as string) === 'win64'
);

export function safeToExtract(entry: Entry) {
	// Only extract and test resource forks on MacOS.
	if (
		!platformIsMac &&
		entry.type === PathType.RESOURCE_FORK
	) {
		return false;
	}

	// Symbolic links on Windows are funky.
	if (
		platformIsWin &&
		entry.type === PathType.SYMLINK
	) {
		return false;
	}

	return true;
}

function bufferToStream(buffer: Buffer) {
	const stream = new Readable({
		read: () => {
			stream.push(buffer);
			stream.push(null);
		}
	});
	return stream;
}

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
		readSymlink: async () => Buffer.from('target')
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
		readSymlink: async () => Buffer.from('target')
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'executable-link',
		mode: 0o755,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		readSymlink: async () => Buffer.from('target')
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
	{
		type: PathType.RESOURCE_FORK,
		pathRaw: 'rsrc-content.bin',
		size: 9,
		readRsrc: async () => bufferToStream(Buffer.from('rsrc fork'))
	}
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
				it('stream', async () => {
					const archive = new ArchiveConstructor(path);

					await archive.read(async entry => {
						const {type, size} = entry;
						const stream = await entry.stream();

						const buffer = stream ?
							await streamToBuffer(stream) :
							null;

						if (buffer) {
							expect(type).not.toBe(PathType.DIRECTORY);

							if (size !== null) {
								expect(buffer.length).toBe(size);
							}
							return;
						}

						expect(type).toBe(PathType.DIRECTORY);
					});
				});

				it('read', async () => {
					const archive = new ArchiveConstructor(path);

					await archive.read(async entry => {
						const {type, size} = entry;
						const {stream, done} = await entry.read();

						const buffer = stream ?
							await streamToBuffer(stream) :
							null;

						if (buffer) {
							expect(type).not.toBe(PathType.DIRECTORY);

							if (size !== null) {
								expect(buffer.length).toBe(size);
							}
						}
						else {
							expect(type).toBe(PathType.DIRECTORY);
						}

						await done;
					});
				});

				it('readBuffer', async () => {
					const archive = new ArchiveConstructor(path);

					await archive.read(async entry => {
						const {type, size} = entry;
						const buffer = await entry.readBuffer();

						if (buffer) {
							expect(type).not.toBe(PathType.DIRECTORY);

							if (size !== null) {
								expect(buffer.length).toBe(size);
							}
							return;
						}

						expect(type).toBe(PathType.DIRECTORY);
					});
				});

				it('extract', async () => {
					const archive = new ArchiveConstructor(path);

					const entries: Entry[] = [];
					await archive.read(async entry => {
						if (entry.hasNamedVolume) {
							expect(entry.volumeName)
								.toBe(entry.path.split('/')[0]);
							expect(entry.volumePath)
								.toBe(entry.path.split('/').slice(1).join('/'));
						}
						else {
							expect(entry.volumeName).toBe(null);
							expect(entry.volumePath).toBe(entry.path);
						}

						expect(zipPathIsMacResource(entry.path))
							.toBe(false, entry.path);

						if (!safeToExtract(entry)) {
							return;
						}

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
								expect(stat.size).toBe(size, dest);
							}
							else if (type === PathType.RESOURCE_FORK) {
								const destRsrc = pathResourceFork(dest);
								const statRsrc = await fsLstat(destRsrc);
								expect(statRsrc.size).toBe(size, dest);
							}
						}

						if (
							!disableMtimeTesting &&
							setMtime &&
							(
								fsLutimesSupported ||
								type !== PathType.SYMLINK
							)
						) {
							const timeDiff = Math.abs(
								stat.mtime.getTime() - setMtime.getTime()
							);
							expect(timeDiff).toBeLessThanOrEqual(
								mtimePrecisionMax,
								dest
							);
						}

						if (
							(
								!platformIsWin &&
								mode !== null
							) &&
							(
								fsLchmodSupported ||
								type !== PathType.SYMLINK
							)
						) {
							expect(modePermissionBits(stat.mode))
								.toBe(modePermissionBits(mode), dest);
						}
					}
				});

				it('cancel', async () => {
					const archive = new ArchiveConstructor(path);

					let count = 0;
					await archive.read(async entry => {
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
			[
				'dummy.file'
			]
		);
	});
});
