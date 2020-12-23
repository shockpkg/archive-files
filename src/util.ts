import {join as pathJoin} from 'path';
import {
	pipeline,
	Readable
} from 'stream';
import {promisify} from 'util';

import fse from 'fs-extra';

import {
	PathType
} from './types';

export interface IFsWalkOptions {

	/**
	 * Ignore unreadable directores when walking directory.
	 *
	 * @default false
	 */
	ignoreUnreadableDirectories?: boolean;
}

const fseLchmod = fse.lchmod as any as (typeof fse.chmod | undefined);
const fseConstants = fse.constants;
// eslint-disable-next-line @typescript-eslint/naming-convention
const {O_WRONLY} = fseConstants;
const O_SYMLINK = defaultNull(fseConstants.O_SYMLINK);

export const streamPipeline = promisify(pipeline);

/**
 * Default value if value is undefined.
 *
 * @param value Value.
 * @param defaultValue Default value.
 * @returns Value or the default value if undefined.
 */
export function defaultValue<T, U>(
	value: T,
	defaultValue: U
): Exclude<T | U, undefined> {
	// eslint-disable-next-line no-undefined
	return value === undefined ? defaultValue : (value as any);
}

/**
 * Default null if value is undefined.
 *
 * @param value Value.
 * @returns Value or null if undefined.
 */
export function defaultNull<T>(value: T) {
	return defaultValue(value, null);
}

/**
 * Create internal error obeject.
 *
 * @returns Error object.
 */
export function errorInternal() {
	return new Error('Internal error');
}

/**
 * Create unsupported path type error object.
 *
 * @param type Path type.
 * @returns Error object.
 */
export function errorUnsupportedPathType(type: PathType) {
	return new Error(`Unsupported path type: ${type}`);
}

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
export function statToPathType(stat: Readonly<fse.Stats>) {
	if (stat.isSymbolicLink()) {
		return PathType.SYMLINK;
	}
	else if (stat.isDirectory()) {
		return PathType.DIRECTORY;
	}
	else if (stat.isFile()) {
		return PathType.FILE;
	}

	// Unsupported type.
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

	// Unsupported type.
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
	return (mode & 0b111111111);
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
 * Get Unix bits from the ZIP file external file attributes.
 *
 * @param attrs Attributes value.
 * @returns Unix bits or null.
 */
export function zipEfaToUnix(attrs: number) {
	// eslint-disable-next-line no-bitwise
	return attrs >>> 16;
}

/**
 * Get stat mode value from ZIP file external file attributes, if present.
 *
 * @param attrs Attributes value.
 * @returns Stat mode or null.
 */
export function zipEfaToUnixMode(attrs: number) {
	const mode = zipEfaToUnix(attrs);

	// Check if type bits are present, else no Unix info.
	// eslint-disable-next-line no-bitwise
	return ((mode >> 12) & 0b1111) ? mode : null;
}

/**
 * Get path type from attributes and path value from ZIP file entry.
 *
 * @param attrs Attributes value.
 * @param path Entry path.
 * @returns Path type.
 */
export function zipPathTypeFromEfaAndPath(attrs: number, path: string) {
	// Check for Unix stat type information.
	const mode = zipEfaToUnixMode(attrs);
	if (!mode) {
		// No Unix type infromation, assume Windows info only.
		// Only files and directories, with directores having a trailing slash.
		return /[\\/]$/.test(path) ? PathType.DIRECTORY : PathType.FILE;
	}
	return modeToPathType(mode);
}

/**
 * Check if path is a Mac resource fork related path.
 *
 * @param path Zip path.
 * @returns Boolean value.
 */
export function zipPathIsMacResource(path: string) {
	return /^__MACOSX(\\|\/|$)/.test(path);
}

/**
 * Read a stream into a buffer.
 * Reading a stream into a buffer should be avoided where possible.
 * This is however useful for some small streams.
 *
 * @param stream Readable stream.
 * @param doneEvent The stream done event.
 * @returns Full buffer.
 */
export async function streamToBuffer(
	stream: Readable,
	doneEvent: string = 'end'
) {
	const buffer = await new Promise<Buffer>((resolve, reject) => {
		const datas: Buffer[] = [];
		let once = false;
		const done = (err?: Error) => {
			if (once) {
				return;
			}
			once = true;
			if (err) {
				reject(err);
				return;
			}
			resolve(Buffer.concat(datas));
		};
		stream.on('data', (data: Buffer) => {
			datas.push(data);
		});
		stream.on('error', err => {
			done(err);
		});
		stream.on(doneEvent, () => {
			done();
		});
	});
	return buffer;
}

/**
 * Awaits stream read end.
 * The stream must be read from.
 * Otherwise this promise will never complete, since the stream will not start.
 *
 * @param stream Stream object.
 * @param doneEvent The stream done event.
 */
export async function streamReadEnd(
	stream: Readable,
	doneEvent: string = 'end'
) {
	await new Promise<void>((resolve, reject) => {
		let once = false;
		const done = (err?: Error) => {
			if (once) {
				return;
			}
			once = true;
			if (err) {
				reject(err);
				return;
			}
			resolve();
		};
		stream.on('error', err => {
			done(err);
		});
		stream.on(doneEvent, () => {
			done();
		});
	});
}

/**
 * Create readable stream from another readable stream.
 * Useful for converting an active stream into an pending stream.
 *
 * @param stream Readable-compatible stream.
 * @returns Readable stream.
 */
export function streamToReadable(stream: Readable) {
	// Pause stream, resumed only when needed.
	stream.pause();

	// Create readable.
	const r = new Readable({
		read: () => {
			stream.resume();
		}
	});

	// Forward data and end.
	stream.on('data', d => {
		r.push(d);
		stream.pause();
	});
	stream.on('end', () => {
		r.push(null);
	});

	// Forward errors both ways.
	const errorsA = new Set<any>();
	const errorsB = new Set<any>();
	stream.on('error', err => {
		if (errorsA.has(err)) {
			return;
		}
		errorsA.add(err);
		r.emit('error', err);
	});
	r.on('error', err => {
		if (errorsB.has(err)) {
			return;
		}
		errorsB.add(err);
		stream.emit('error', err);
	});
	return r;
}

/**
 * Write stream source to file destination.
 *
 * @param source Stream source.
 * @param destination File destination.
 */
export async function streamToFile(
	source: Readable,
	destination: fse.WriteStream
) {
	await streamPipeline(source, destination);
}

/**
 * Wrapper for lchmod, does nothing on unsupported platforms.
 *
 * @param path File path.
 * @param mode File mode.
 */
export async function fsLchmod(path: string, mode: number) {
	if (fseLchmod && O_SYMLINK !== null) {
		await fseLchmod(path, mode);
	}
}

export const fsLchmodSupported = !!(fseLchmod && O_SYMLINK !== null);

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
	await fse.utimes(path, atime as Date, mtime as Date);
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
	// If lchmod is unsupported, lutimes should be also.
	if (!(fseLchmod && O_SYMLINK !== null)) {
		return;
	}

	// Node does not currently implement lutimes.
	// It can be done though the file descriptor.
	// Essentially this is what the lchmod implementation does.
	// eslint-disable-next-line no-bitwise
	const fd = await fse.open(path, O_WRONLY | O_SYMLINK);
	await fse.futimes(fd, atime as Date, mtime as Date);
	await fse.close(fd);
}

export const fsLutimesSupported = !!(fseLchmod && O_SYMLINK !== null);

/**
 * A readlink wrapper that returns raw link buffer.
 *
 * @param path Link path.
 * @returns Raw link.
 */
export async function fsReadlinkRaw(path: string) {
	const r = await (fse.readlink as any)(path, 'buffer');
	return r as Buffer;
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
	try {
		await fse.symlink(target as string | Buffer, path as string | Buffer);
	}
	catch (err) {
		// Workaround for issue in Node v14.5.0 on Windows.
		if (err.name === 'TypeError' && typeof target !== 'string') {
			await fse.symlink(target.toString(), path as string | Buffer);
		}
		else {
			throw err;
		}
	}
}

/**
 * Wrapper for chmod.
 *
 * @param path File path.
 * @param mode File mode.
 */
export async function fsChmod(path: string, mode: number) {
	await fse.chmod(path, mode);
}

/**
 * A readdir wrapper with consistent output.
 *
 * @param path Directory path.
 * @returns Directory listing.
 */
export async function fsReaddir(path: string) {
	return (await fse.readdir(path)).sort();
}

/**
 * An lstat wrapper.
 *
 * @param path Path string.
 * @returns Stat object.
 */
export async function fsLstat(path: string) {
	const r = await fse.lstat(path);
	return r;
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
	}
	catch (err) {
		const {code} = err;
		if (
			code === 'ENOENT' ||
			code === 'ENOTDIR'
		) {
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
	itter: (
		path: string,
		stat: fse.Stats
	) => Promise<boolean | null | void>,
	options: Readonly<IFsWalkOptions> = {}
) {
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
		}
		catch (err) {
			if (
				err &&
				options.ignoreUnreadableDirectories &&
				err.code === 'EACCES'
			) {
				// Skip it.
			}
			else {
				throw err;
			}
		}
		for (let i = subs.length; i--;) {
			stack.push(pathJoin(entry, subs[i]));
		}
	}
}
