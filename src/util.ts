import {Stats, constants as fsConstants} from 'node:fs';
import {
	chmod,
	lstat,
	open,
	readdir,
	readlink,
	symlink,
	utimes
} from 'node:fs/promises';
import {join as pathJoin} from 'node:path';
import {Readable} from 'node:stream';

import {PathType} from './types';

export interface IFsWalkOptions {
	/**
	 * Ignore unreadable directores when walking directory.
	 *
	 * @default false
	 */
	ignoreUnreadableDirectories?: boolean;
}

const {O_WRONLY, O_SYMLINK} = fsConstants;
export const fsLchmodSupported = !!O_SYMLINK;
export const fsLutimesSupported = !!O_SYMLINK;

/**
 * Normalize an entry path.
 *
 * @param path Path string.
 * @returns Normalized path.
 */
export function pathNormalize(path: string) {
	return path.replace(/\\/g, '/').replace(/([^/])\/+$/, '$1');
}

/**
 * Get path to the resource fork pseudo-file.
 *
 * @param path Path string.
 * @returns Resource fork pseudo-file path.
 */
export function pathResourceFork(path: string) {
	return pathJoin(path, '..namedfork', 'rsrc');
}

/**
 * Get path type from stat object, or null if unsupported.
 *
 * @param stat Stats object.
 * @returns Path type.
 */
export function statToPathType(stat: Readonly<Stats>) {
	if (stat.isSymbolicLink()) {
		return PathType.SYMLINK;
	}
	if (stat.isDirectory()) {
		return PathType.DIRECTORY;
	}
	if (stat.isFile()) {
		return PathType.FILE;
	}
	return null;
}

/**
 * Get path type from stat mode, or null if unsupported.
 *
 * @param mode Stat mode.
 * @returns Path type.
 */
export function modeToPathType(mode: number) {
	if (bitwiseAndEqual(mode, 0o0120000)) {
		return PathType.SYMLINK;
	}
	if (bitwiseAndEqual(mode, 0o0040000)) {
		return PathType.DIRECTORY;
	}
	if (bitwiseAndEqual(mode, 0o0100000)) {
		return PathType.FILE;
	}
	return null;
}

/**
 * Get permission bits from mode value.
 *
 * @param mode Stat mode.
 * @returns Permission bits.
 */
export function modePermissionBits(mode: number) {
	// eslint-disable-next-line no-bitwise
	return mode & 0b111111111;
}

/**
 * Check if all the bits set.
 *
 * @param value Bits value.
 * @param mask Mask value.
 * @returns True of all the bits set.
 */
export function bitwiseAndEqual(value: number, mask: number) {
	// eslint-disable-next-line no-bitwise
	return (value & mask) === mask;
}

/**
 * Read a stream into a buffer.
 * Reading a stream into a buffer should be avoided where possible.
 * This is however useful for some small streams.
 *
 * @param stream Readable stream.
 * @returns Full buffer.
 */
export async function streamToBuffer(stream: Readable) {
	const buffer = await new Promise<Buffer>((resolve, reject) => {
		const datas: Buffer[] = [];
		let done = false;
		stream.on('data', (data: Buffer) => {
			datas.push(data);
		});
		stream.on('error', err => {
			if (!done) {
				done = true;
				reject(err);
			}
		});
		stream.on('end', () => {
			if (!done) {
				done = true;
				resolve(Buffer.concat(datas));
			}
		});
	});
	return buffer;
}

/**
 * Wrapper for lchmod, does nothing on unsupported platforms.
 *
 * @param path File path.
 * @param mode File mode.
 */
export async function fsLchmod(path: string, mode: number) {
	// Skip if not supported.
	if (!fsLchmodSupported) {
		return;
	}

	// eslint-disable-next-line no-bitwise
	const fd = await open(path, O_WRONLY | O_SYMLINK);
	try {
		await fd.chmod(mode);
	} finally {
		await fd.close();
	}
}

/**
 * Wrapper for utimes.
 *
 * @param path File path.
 * @param atime Access time.
 * @param mtime Modification time.
 */
export async function fsUtimes(
	path: string,
	atime: Readonly<Date>,
	mtime: Readonly<Date>
) {
	await utimes(path, atime, mtime);
}

/**
 * Implementation of lutimes, does nothing on unsupported platforms.
 *
 * @param path File path.
 * @param atime Access time.
 * @param mtime Modification time.
 */
export async function fsLutimes(
	path: string,
	atime: Readonly<Date>,
	mtime: Readonly<Date>
) {
	// Skip if not supported.
	if (!fsLutimesSupported) {
		return;
	}

	// eslint-disable-next-line no-bitwise
	const fd = await open(path, O_WRONLY | O_SYMLINK);
	try {
		await fd.utimes(atime, mtime);
	} finally {
		await fd.close();
	}
}

/**
 * A readlink wrapper that returns raw link buffer.
 *
 * @param path Link path.
 * @returns Raw link.
 */
export async function fsReadlinkRaw(path: string) {
	return readlink(path, 'buffer');
}

/**
 * Wrapper for symlink.
 *
 * @param path Path of symbolic link.
 * @param target Target of symbolic link.
 */
export async function fsSymlink(
	path: string | Readonly<Buffer>,
	target: string | Readonly<Buffer>
) {
	await symlink(target, path);
}

/**
 * Wrapper for chmod.
 *
 * @param path File path.
 * @param mode File mode.
 */
export async function fsChmod(path: string, mode: number) {
	await chmod(path, mode);
}

/**
 * A readdir wrapper with consistent output.
 *
 * @param path Directory path.
 * @returns Directory listing.
 */
export async function fsReaddir(path: string) {
	return (await readdir(path)).sort();
}

/**
 * An lstat wrapper.
 *
 * @param path Path string.
 * @returns Stat object.
 */
export async function fsLstat(path: string) {
	return lstat(path);
}

/**
 * An lstat wrapper returning null if not exist.
 *
 * @param path Path string.
 * @returns Stat object.
 */
export async function fsLstatExists(path: string) {
	try {
		return await fsLstat(path);
	} catch (err) {
		const {code} = err as {code: string};
		if (code === 'ENOENT' || code === 'ENOTDIR') {
			return null;
		}
		throw err;
	}
}

/**
 * Walk file system path.
 * If callback returns false skips recursing a directory.
 * If callback returns null aborts walking.
 *
 * @param base Directory path.
 * @param itter Callback for each entry.
 * @param options Walk options.
 */
export async function fsWalk(
	base: string,
	itter: (path: string, stat: Stats) => Promise<boolean | null | void>,
	options: Readonly<IFsWalkOptions> = {}
) {
	const {ignoreUnreadableDirectories} = options;
	const stack = (await fsReaddir(base)).reverse();
	while (stack.length) {
		const entry = stack.pop() as string;
		const fullPath = pathJoin(base, entry);
		// eslint-disable-next-line no-await-in-loop
		const stat = await fsLstat(fullPath);

		// Callback, possibly stop recursion on directory.
		// eslint-disable-next-line no-await-in-loop
		const recurse = await itter(entry, stat);
		if (recurse === null) {
			break;
		}
		if (recurse === false || !stat.isDirectory()) {
			continue;
		}

		// Recurse down.
		let subs: string[] = [];
		try {
			// eslint-disable-next-line no-await-in-loop
			subs = await fsReaddir(fullPath);
		} catch (err) {
			if (
				!(
					err &&
					ignoreUnreadableDirectories &&
					(err as {code: string}).code === 'EACCES'
				)
			) {
				throw err;
			}
		}
		for (let i = subs.length; i--; ) {
			stack.push(pathJoin(entry, subs[i]));
		}
	}
}
