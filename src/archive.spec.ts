/* eslint-disable max-nested-callbacks, max-classes-per-file */

import {describe, it} from 'node:test';
import {ok, strictEqual, notStrictEqual} from 'node:assert';
import {mkdir, rm} from 'node:fs/promises';
import {platform as osPlatform} from 'node:os';
import {join as pathJoin} from 'node:path';
import {Readable, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import {Archive, Entry, IEntryInfo} from './archive';
import {PathType} from './types';
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
	// eslint-disable-next-line no-process-env
	process.env.ARCHIVE_FILES_DISABLE_MTIME_TESTING === '1';

export const specTmpPath = (
	(i: number) => (s: string) =>
		pathJoin('spec', 'tmp', s, `${i++}`)
)(0);
export const specFixturesPath = pathJoin('spec', 'fixtures');

export const mtimePrecisionMax = 2000;

export const platform = osPlatform();
export const platformIsMac = platform === 'darwin';
export const platformIsWin =
	platform === 'win32' || (platform as string) === 'win64';

export function safeToExtract(entry: Entry) {
	// Only extract and test resource forks on MacOS.
	if (!platformIsMac && entry.type === PathType.RESOURCE_FORK) {
		return false;
	}

	// Symbolic links on Windows are funky.
	if (platformIsWin && entry.type === PathType.SYMLINK) {
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
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () => bufferToStream(Buffer.from('foo bar\n'))
	},
	{
		type: PathType.DIRECTORY,
		pathRaw: 'directory'
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'symlink',
		// eslint-disable-next-line @typescript-eslint/require-await
		readSymlink: async () => Buffer.from('target')
	},
	{
		type: PathType.FILE,
		pathRaw: 'directory/subfile.txt',
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'unknown/orphaned.txt',
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'nonexecutable.txt',
		mode: 0o644,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () =>
			bufferToStream(Buffer.from('#!/bin/sh\necho nonexecutable\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'executable.sh',
		mode: 0o755,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () =>
			bufferToStream(Buffer.from('#!/bin/sh\necho executable\n'))
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'nonexecutable-link',
		mode: 0o644,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		// eslint-disable-next-line @typescript-eslint/require-await
		readSymlink: async () => Buffer.from('target')
	},
	{
		type: PathType.SYMLINK,
		pathRaw: 'executable-link',
		mode: 0o755,
		atime: new Date('2013-02-16'),
		mtime: new Date('2014-03-24'),
		// eslint-disable-next-line @typescript-eslint/require-await
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
		// eslint-disable-next-line @typescript-eslint/require-await
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
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () => bufferToStream(Buffer.from('sub file\n'))
	},
	{
		type: PathType.FILE,
		pathRaw: 'rsrc-content.bin',
		size: 4,
		// eslint-disable-next-line @typescript-eslint/require-await
		readData: async () => bufferToStream(Buffer.from('data'))
	},
	{
		type: PathType.RESOURCE_FORK,
		pathRaw: 'rsrc-content.bin',
		size: 9,
		// eslint-disable-next-line @typescript-eslint/require-await
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

	public async read(itter: (entry: EntryTest) => Promise<unknown>) {
		await super.read(itter);
	}

	protected async _read(itter: (entry: EntryTest) => Promise<unknown>) {
		for (const info of testEntries) {
			const entry = new this.Entry({archive: this, ...info});
			// eslint-disable-next-line no-await-in-loop
			const ret = await entry.trigger(itter);
			if (ret === false) {
				break;
			}
		}
	}
}

export function testArchive(
	ArchiveConstructor: new (path: string) => Archive,
	paths: string[],
	skippable: boolean,
	setup: (path: string, tmpdir: string) => Promise<string> | string
) {
	if (!paths.length) {
		void it('no supported paths', () => {
			strictEqual(true, true);
		});
		return;
	}

	const withSetup = async (
		path: string,
		f: (path: string, tmpdir: string) => unknown
	) => {
		const tmpdir = specTmpPath(ArchiveConstructor.name);
		await rm(tmpdir, {recursive: true, force: true});
		await mkdir(tmpdir, {recursive: true});
		try {
			await f(await setup(path, tmpdir), tmpdir);
		} finally {
			await rm(tmpdir, {recursive: true, force: true});
		}
	};

	for (const path of paths) {
		// eslint-disable-next-line no-loop-func
		void describe(path, () => {
			void describe('read', () => {
				void it('stream', async () => {
					await withSetup(path, async path => {
						const archive = new ArchiveConstructor(path);

						await archive.read(async entry => {
							const {type, size} = entry;
							const stream = await entry.stream();

							const buffer = stream
								? await streamToBuffer(stream)
								: null;

							if (buffer) {
								notStrictEqual(type, PathType.DIRECTORY);

								if (size !== null) {
									strictEqual(buffer.length, size);
								}
								return;
							}

							strictEqual(type, PathType.DIRECTORY);
						});
					});
				});

				void it('read', async () => {
					await withSetup(path, async path => {
						const archive = new ArchiveConstructor(path);

						await archive.read(async entry => {
							const {type, size} = entry;
							const buffer = await entry.read();

							if (buffer) {
								notStrictEqual(type, PathType.DIRECTORY);

								if (size !== null) {
									strictEqual(buffer.length, size);
								}
								return;
							}

							strictEqual(type, PathType.DIRECTORY);
						});
					});
				});

				void it('extract', async () => {
					await withSetup(path, async (path, tmpdir) => {
						const archive = new ArchiveConstructor(path);
						const extractDir = pathJoin(tmpdir, 'extract');

						const entries: Entry[] = [];
						await archive.read(async entry => {
							if (entry.hasNamedVolume) {
								strictEqual(
									entry.volumeName,
									entry.path.split('/')[0]
								);
								strictEqual(
									entry.volumePath,
									entry.path.split('/').slice(1).join('/')
								);
							} else {
								strictEqual(entry.volumeName, null);
								strictEqual(entry.volumePath, entry.path);
							}

							strictEqual(
								zipPathIsMacResource(entry.path),
								false
							);

							if (!safeToExtract(entry)) {
								return;
							}

							entries.push(entry);
							const dest = pathJoin(extractDir, entry.path);
							await entry.extract(dest);
						});

						ok(entries.length > 1);

						for (const entry of entries) {
							const dest = pathJoin(extractDir, entry.path);
							// eslint-disable-next-line no-await-in-loop
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
									strictEqual(stat.size, size);
								} else if (type === PathType.RESOURCE_FORK) {
									const destRsrc = pathResourceFork(dest);
									// eslint-disable-next-line no-await-in-loop
									const statRsrc = await fsLstat(destRsrc);
									strictEqual(statRsrc.size, size);
								}
							}

							if (
								!disableMtimeTesting &&
								setMtime &&
								(fsLutimesSupported ||
									type !== PathType.SYMLINK)
							) {
								const timeDiff = Math.abs(
									stat.mtime.getTime() - setMtime.getTime()
								);
								ok(timeDiff <= mtimePrecisionMax);
							}

							if (
								!platformIsWin &&
								mode !== null &&
								(fsLchmodSupported || type !== PathType.SYMLINK)
							) {
								strictEqual(
									modePermissionBits(stat.mode),
									modePermissionBits(mode)
								);
							}
						}
					});
				});

				void it('cancel', async () => {
					await withSetup(path, async path => {
						const archive = new ArchiveConstructor(path);

						let count = 0;
						// eslint-disable-next-line @typescript-eslint/require-await
						await archive.read(async entry => {
							count++;
							return false;
						});

						strictEqual(count, 1);
					});
				});

				void it('pipeline', async () => {
					await withSetup(path, async path => {
						const archive = new ArchiveConstructor(path);

						await archive.read(async entry => {
							const {size} = entry;
							const stream = await entry.stream();

							if (!stream) {
								return;
							}

							// Ensure stream does not read before we do.
							strictEqual(stream.listenerCount('data'), 0);
							await new Promise(resolve =>
								setTimeout(resolve, 100)
							);

							let read = 0;
							await pipeline(
								stream,
								new Writable({
									write: (chunk: Buffer, _encoding, cb) => {
										read += chunk.length;
										cb();
									}
								})
							);
							if (size !== null) {
								strictEqual(read, size);
							}
						});
					});
				});

				if (skippable) {
					void it('skip', async () => {
						await withSetup(path, async path => {
							const archive = new ArchiveConstructor(path);

							const seen: string[] = [];
							// eslint-disable-next-line @typescript-eslint/require-await
							await archive.read(async entry => {
								const {path} = entry;
								for (const p of seen) {
									if (
										path.startsWith(`${p}/`) ||
										path.startsWith(`${p}\\`)
									) {
										throw new Error('Skip failed');
									}
								}
								seen.push(path);

								return null;
							});
						});
					});
				}
			});
		});
	}
}
