/* eslint-disable max-classes-per-file */

import {createWriteStream} from 'node:fs';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {Readable, pipeline} from 'node:stream';
import {promisify} from 'node:util';

const pipe = promisify(pipeline);

import {PathType} from './types.ts';
import {
	fsChmod,
	fsLchmod,
	fsLstatExists,
	fsLutimes,
	fsSymlink,
	fsUtimes,
	modePermissionBits,
	pathNormalize,
	pathResourceFork,
	streamToBuffer
} from './util.ts';

export interface IArchiveAfterReadSetAttributesEntry {
	/**
	 * Extract path, relative.
	 */
	path: string;

	/**
	 * Entry.
	 */
	entry: Entry;

	/**
	 * Extract options.
	 */
	options: IExtractOptions;
}

export interface IExtractOptions {
	/**
	 * Replace whatever may be at the path.
	 * A directory will not replace another directory.
	 *
	 * @default false
	 */
	replace?: boolean;

	/**
	 * Ignore permissions when extracting.
	 *
	 * @default false
	 */
	ignorePermissions?: boolean;

	/**
	 * Ignore file modification and access times when extracting.
	 *
	 * @default false
	 */
	ignoreTimes?: boolean;

	/**
	 * Extract resource fork as a file.
	 *
	 * @default false
	 */
	resourceForkAsFile?: boolean;

	/**
	 * Extract symlink as a file.
	 *
	 * @default false
	 */
	symlinkAsFile?: boolean;
}

export interface IEntryInfo {
	/**
	 * Entry archive.
	 */
	archive: Archive;

	/**
	 * Entry type.
	 */
	type: PathType;

	/**
	 * Entry path, raw.
	 */
	pathRaw: string;

	/**
	 * Entry size.
	 */
	size?: number | null;

	/**
	 * Entry size, compressed.
	 */
	sizeComp?: number | null;

	/**
	 * Entry mode.
	 */
	mode?: number | null;

	/**
	 * Entry uid.
	 */
	uid?: number | null;

	/**
	 * Entry gid.
	 */
	gid?: number | null;

	/**
	 * Entry uname.
	 */
	uname?: string | null;

	/**
	 * Entry gname.
	 */
	gname?: string | null;

	/**
	 * Entry atime.
	 */
	atime?: Date | null;

	/**
	 * Entry mtime.
	 */
	mtime?: Date | null;

	/**
	 * Read data.
	 */
	readData?: (() => Promise<Readable | null>) | null;

	/**
	 * Read rsrc.
	 */
	readRsrc?: (() => Promise<Readable | null>) | null;

	/**
	 * Read symlink.
	 */
	readSymlink?: (() => Promise<Buffer>) | null;
}

/**
 * Entry object.
 */
export abstract class Entry {
	/**
	 * Entry archive.
	 */
	public readonly archive: Archive;

	/**
	 * Entry type.
	 */
	public readonly type: PathType;

	/**
	 * Entry path.
	 */
	public readonly path: string;

	/**
	 * Entry path, raw.
	 */
	public readonly pathRaw: string;

	/**
	 * Entry size.
	 */
	public readonly size: number | null;

	/**
	 * Entry size, compressed.
	 */
	public readonly sizeComp: number | null;

	/**
	 * Entry mode.
	 */
	public readonly mode: number | null;

	/**
	 * Entry uid.
	 */
	public readonly uid: number | null;

	/**
	 * Entry gid.
	 */
	public readonly gid: number | null;

	/**
	 * Entry uname.
	 */
	public readonly uname: string | null;

	/**
	 * Entry gname.
	 */
	public readonly gname: string | null;

	/**
	 * Entry atime.
	 */
	public readonly atime: Date | null;

	/**
	 * Entry mtime.
	 */
	public readonly mtime: Date | null;

	/**
	 * Read data.
	 */
	protected readonly _readData: (() => Promise<Readable | null>) | null;

	/**
	 * Read rsrc.
	 */
	protected readonly _readRsrc: (() => Promise<Readable | null>) | null;

	/**
	 * Read symlink.
	 */
	protected readonly _readSymlink: (() => Promise<Buffer>) | null;

	/**
	 * Entry triggering.
	 */
	protected _triggering = false;

	/**
	 * Entry triggered.
	 */
	protected _triggered = false;

	/**
	 * Entry extracted.
	 */
	protected _extracted = false;

	/**
	 * Entry constructor.
	 *
	 * @param info Info object.
	 */
	constructor(info: Readonly<IEntryInfo>) {
		this.archive = info.archive;
		this.type = info.type;
		this.pathRaw = info.pathRaw;
		this.path = pathNormalize(info.pathRaw);
		this.size = info.size ?? null;
		this.sizeComp = info.sizeComp ?? null;
		this.mode = info.mode ?? null;
		this.uid = info.uid ?? null;
		this.gid = info.gid ?? null;
		this.uname = info.uname ?? null;
		this.gname = info.gname ?? null;
		this.atime = info.atime ?? null;
		this.mtime = info.mtime ?? null;
		this._readData = info.readData ?? null;
		this._readRsrc = info.readRsrc ?? null;
		this._readSymlink = info.readSymlink ?? null;
	}

	/**
	 * This entry path includes named volume.
	 *
	 * @returns Entry has volume name in path.
	 */
	public get hasNamedVolume() {
		return this.archive.hasNamedVolumes;
	}

	/**
	 * This entry volume name, or null.
	 *
	 * @returns Entry path volume name.
	 */
	public get volumeName() {
		if (this.hasNamedVolume) {
			const {path} = this;
			return path.slice(0, path.indexOf('/'));
		}
		return null;
	}

	/**
	 * This entry path without any possible volume name.
	 *
	 * @returns Entry path without the volume name.
	 */
	public get volumePath() {
		const {path} = this;
		if (this.hasNamedVolume) {
			return path.slice(path.indexOf('/') + 1);
		}
		return path;
	}

	/**
	 * Read entry as stream, or null if nothing to read.
	 * Consuming function will need to wait for stream to close.
	 *
	 * @returns Readable stream or null if nothing to read.
	 */
	public async stream() {
		this._beginExtract();
		return this._stream();
	}

	/**
	 * Read entire entry into a Buffer.
	 *
	 * @returns Buffer or null if nothing to be read.
	 */
	public async read() {
		this._beginExtract();
		const stream = await this._stream();
		return stream ? streamToBuffer(stream) : null;
	}

	/**
	 * Extract entry.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	public async extract(
		path: string,
		options: Readonly<IExtractOptions> = {}
	) {
		this._beginExtract();
		await this._extract(path, options);
	}

	/**
	 * Trigger on itterator function.
	 *
	 * @param itter Itterator function.
	 * @returns Return value.
	 */
	public async trigger<T, U extends (entry: this) => Promise<T>>(itter: U) {
		let r: T;
		if (this._triggered) {
			throw new Error('Archive entry already triggered');
		}
		this._triggered = this._triggering = true;
		try {
			r = await itter(this);
		} finally {
			this._triggering = false;
		}
		return r;
	}

	/**
	 * Run again after reading.
	 *
	 * @param path Extract path, relative.
	 * @param pathFull An optional full path to be used.
	 * @param options Extract options.
	 */
	public async setAttributes(
		path: string,
		pathFull: string | null = null,
		options: Readonly<IExtractOptions> = {}
	) {
		const pathSet = pathFull === null ? path : pathFull;

		const {ignorePermissions, ignoreTimes} = options;

		const {type, mode, atime, mtime} = this;

		let link = false;
		switch (type) {
			case PathType.FILE: {
				break;
			}
			case PathType.RESOURCE_FORK: {
				break;
			}
			case PathType.DIRECTORY: {
				break;
			}
			case PathType.SYMLINK: {
				link = true;
				break;
			}
			default: {
				throw new Error(`Unsupported path type: ${type as string}`);
			}
		}

		const atimeSet = atime || mtime || null;
		const mtimeSet = mtime || atime || null;

		if (!ignorePermissions && mode !== null) {
			const chmod = link ? fsLchmod : fsChmod;
			const modeSet = modePermissionBits(mode);
			await chmod(pathSet, modeSet);
		}

		if (!ignoreTimes && atimeSet && mtimeSet) {
			const utimes = link ? fsLutimes : fsUtimes;
			await utimes(pathSet, atimeSet, mtimeSet);
		}
	}

	/**
	 * Method to call before begining extraction.
	 * Throws error if extraction already started or entry not active.
	 */
	protected _beginExtract() {
		if (!this._triggering) {
			throw new Error('Archive entry is not active');
		}
		if (this._extracted) {
			throw new Error('Archive entry can only be extracted once');
		}
		this._extracted = true;
	}

	/**
	 * Create an extract error for path that exists.
	 *
	 * @param path Extract path.
	 * @returns Error object.
	 */
	protected _errorExtractPathExists(path: string) {
		return new Error(`Extract path already exists: ${path}`);
	}

	/**
	 * Create an extract error for a resource fork not going to a file.
	 *
	 * @param path Extract path.
	 * @returns Error object.
	 */
	protected _errorNoResourceFork(path: string) {
		return new Error(`Extract path for resource fork not a file: ${path}`);
	}

	/**
	 * Extract entry.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	protected async _extract(path: string, options: Readonly<IExtractOptions>) {
		this.archive.afterReadSetAttributesRemove(path);

		const {type} = this;
		switch (type) {
			case PathType.FILE: {
				await this._extractFile(path, options);
				break;
			}
			case PathType.RESOURCE_FORK: {
				await this._extractResourceFork(path, options);
				break;
			}
			case PathType.DIRECTORY: {
				await this._extractDirectory(path, options);
				break;
			}
			case PathType.SYMLINK: {
				await this._extractSymlink(path, options);
				break;
			}
			default: {
				throw new Error(`Unsupported path type: ${type as string}`);
			}
		}
	}

	/**
	 * Base function for extracting stream to a file.
	 *
	 * @param path Extract path.
	 * @param reader Reader function.
	 * @param options Extract options.
	 */
	protected async _extractStreamToFile(
		path: string,
		reader: () => Promise<Readable | null>,
		options: Readonly<IExtractOptions>
	) {
		const {replace} = options;

		// Check if something exists at path, optionally removing.
		const stat = await fsLstatExists(path);
		if (stat) {
			// If replacing, then remove, else throw.
			if (replace) {
				await rm(path, {recursive: true, force: true});
			} else {
				throw this._errorExtractPathExists(path);
			}
		} else {
			await mkdir(dirname(path), {recursive: true});
		}

		// Write file.
		await writeFile(path, Buffer.alloc(0));
		const stream = await reader();
		if (stream) {
			await pipe(stream, createWriteStream(path));
		}

		// Set attributes.
		await this.setAttributes(path, null, options);
	}

	/**
	 * Extract as a file.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	protected async _extractFile(
		path: string,
		options: Readonly<IExtractOptions>
	) {
		const readData = this._readData;
		if (!readData) {
			throw new Error('Internal error');
		}

		await this._extractStreamToFile(path, readData, options);
	}

	/**
	 * Extract as resource fork to an existing file.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	protected async _extractResourceFork(
		path: string,
		options: Readonly<IExtractOptions>
	) {
		const readRsrc = this._readRsrc;
		if (!readRsrc) {
			throw new Error('Internal error');
		}

		// Optionally extract as a data file.
		if (options.resourceForkAsFile) {
			await this._extractStreamToFile(path, readRsrc, options);
			return;
		}

		// Check if file exists at path, else throw.
		const stat = await fsLstatExists(path);
		if (!stat || !stat.isFile()) {
			throw this._errorNoResourceFork(path);
		}

		// Create resource fork path.
		const pathRsrc = pathResourceFork(path);

		// Write the resource fork.
		const stream = await readRsrc();

		// eslint-disable-next-line unicorn/prefer-ternary
		if (stream) {
			await pipe(stream, createWriteStream(pathRsrc));
		} else {
			await writeFile(pathRsrc, Buffer.alloc(0));
		}

		// Set attributes.
		await this.setAttributes(path, null, options);
	}

	/**
	 * Extract as a directory.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	protected async _extractDirectory(
		path: string,
		options: Readonly<IExtractOptions>
	) {
		const {replace} = options;

		// Check if something exists at path, else create.
		const stat = await fsLstatExists(path);
		if (stat) {
			// If not directory, then remove and replace it, else throw.
			if (!stat.isDirectory()) {
				if (replace) {
					await rm(path, {recursive: true, force: true});
					await mkdir(path, {recursive: true});
				} else {
					throw this._errorExtractPathExists(path);
				}
			}
		} else {
			await mkdir(path, {recursive: true});
		}

		// Set directory attributes after any children are added.
		this.archive.afterReadSetAttributes(path, this, {...options});
	}

	/**
	 * Extract as a symlink.
	 *
	 * @param path Extract path.
	 * @param options Extract options.
	 */
	protected async _extractSymlink(
		path: string,
		options: Readonly<IExtractOptions>
	) {
		const readSymlink = this._readSymlink;
		if (!readSymlink) {
			throw new Error('Internal error');
		}

		const {replace, symlinkAsFile} = options;

		// Check if something exists at path, optionally removing.
		const stat = await fsLstatExists(path);
		if (stat) {
			// If replacing, then remove, else throw.
			if (replace) {
				await rm(path, {recursive: true, force: true});
			} else {
				throw this._errorExtractPathExists(path);
			}
		} else {
			// Ensure base directory exists.
			await mkdir(dirname(path), {recursive: true});
		}

		// Read target.
		const target = await readSymlink();

		// Create link, optionally as a file.
		// eslint-disable-next-line unicorn/prefer-ternary
		if (symlinkAsFile) {
			await writeFile(path, target);
		} else {
			await fsSymlink(path, target);
		}

		// Set attributes.
		await this.setAttributes(path, null, options);
	}

	/**
	 * Read as stream.
	 *
	 * @returns Readable stream.
	 */
	protected async _stream() {
		const {type} = this;
		switch (type) {
			case PathType.FILE: {
				return this._streamFile();
			}
			case PathType.RESOURCE_FORK: {
				return this._streamResourceFork();
			}
			case PathType.DIRECTORY: {
				return this._streamDirectory();
			}
			case PathType.SYMLINK: {
				return this._streamSymlink();
			}
			default: {
				throw new Error(`Unsupported path type: ${type as string}`);
			}
		}
	}

	/**
	 * Read file as stream.
	 *
	 * @returns Readable stream.
	 */
	protected async _streamFile() {
		const readData = this._readData;
		if (!readData) {
			throw new Error('Internal error');
		}
		return readData();
	}

	/**
	 * Read resource fork as stream.
	 *
	 * @returns Readable stream.
	 */
	protected async _streamResourceFork() {
		const readRsrc = this._readRsrc;
		if (!readRsrc) {
			throw new Error('Internal error');
		}
		return readRsrc();
	}

	/**
	 * Read directory null stream.
	 *
	 * @returns Null stream.
	 */
	protected async _streamDirectory() {
		return null;
	}

	/**
	 * Read symlink as stream.
	 *
	 * @returns Readable stream.
	 */
	protected async _streamSymlink() {
		const readSymlink = this._readSymlink;
		if (!readSymlink) {
			throw new Error('Internal error');
		}
		const r = new Readable({
			// eslint-disable-next-line jsdoc/require-jsdoc
			read: () => {
				readSymlink().then(
					d => {
						r.push(d);
						// eslint-disable-next-line unicorn/no-array-push-push
						r.push(null);
					},
					err => {
						r.emit('error', err);
					}
				);
			}
		});
		return r;
	}
}

/**
 * Archive object.
 */
export abstract class Archive {
	/**
	 * List of file extensions, or null.
	 */
	public static readonly FILE_EXTENSIONS: readonly string[] | null = null;

	/**
	 * Archive has named volumes that each entry will be under.
	 */
	public static readonly HAS_NAMED_VOLUMES: boolean = false;

	/**
	 * Entry constructor.
	 */
	public readonly Entry = Entry;

	/**
	 * File path.
	 */
	public readonly path: string;

	/**
	 * Flag for currently reading.
	 */
	protected _reading = false;

	/**
	 * Map of entries to set attributes on after reading.
	 */
	protected _afterReadSetAttributes: Map<
		string,
		Readonly<IArchiveAfterReadSetAttributesEntry>
	> | null = null;

	/**
	 * Archive constructor.
	 *
	 * @param path File path.
	 */
	constructor(path: string) {
		this.path = path;
	}

	/**
	 * List of file extensions used by this format.
	 *
	 * @returns List of file extensions.
	 */
	public get fileExtensions() {
		return (this.constructor as typeof Archive).FILE_EXTENSIONS || null;
	}

	/**
	 * Archive has named volumes that each entry will be under.
	 *
	 * @returns Archive has named volumns.
	 */
	public get hasNamedVolumes() {
		return (this.constructor as typeof Archive).HAS_NAMED_VOLUMES;
	}

	/**
	 * Add an instance to set attributes after the read finishes.
	 *
	 * @param path Path string.
	 * @param entry Entry instance.
	 * @param options Extract options.
	 */
	public afterReadSetAttributes(
		path: string,
		entry: Entry,
		options: Readonly<IExtractOptions> = {}
	) {
		const afters = this._afterReadSetAttributes;
		if (!afters) {
			throw new Error(
				'Archive after read callbacks can only be added while reading'
			);
		}
		afters.set(resolve(path), {
			path,
			entry,
			options
		});
	}

	/**
	 * Remove an instance to set attributes after the read finishes.
	 *
	 * @param path Path string.
	 */
	public afterReadSetAttributesRemove(path: string) {
		const afters = this._afterReadSetAttributes;
		if (!afters) {
			throw new Error(
				'Archive after read callbacks can only be removed while reading'
			);
		}
		afters.delete(resolve(path));
	}

	/**
	 * Read archive.
	 * If the itter callback returns false, reading ends.
	 * If the itter callback returns null, skip descent where available.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: Entry) => Promise<unknown>) {
		if (this._reading) {
			throw new Error('Archive already being read');
		}
		this._reading = true;

		// Reset the after entries.
		this._afterReadSetAttributes = new Map();

		// Read and handle all the afters, reset after.
		try {
			await this._read(itter);
			await this._afterReadSetAttributesTrigger();
		} finally {
			this._afterReadSetAttributes = null;
			this._reading = false;
		}
	}

	/**
	 * Run all after read set attributes.
	 */
	protected async _afterReadSetAttributesTrigger() {
		const afters = this._afterReadSetAttributes;
		if (!afters) {
			return;
		}

		// Prioritize by path length.
		const resolves: string[] = [];
		for (const [resolved] of afters) {
			resolves.push(resolved);
		}
		resolves.sort((a, b) => b.length - a.length);

		for (const resolved of resolves) {
			const ent = afters.get(resolved);
			if (!ent) {
				throw new Error('Internal error');
			}
			const {entry, path, options} = ent;
			// eslint-disable-next-line no-await-in-loop
			await entry.setAttributes(path, resolved, options);
		}
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 * If the itter callback returns null, skip descent where available.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected abstract _read(
		itter: (entry: Entry) => Promise<unknown>
	): Promise<void>;
}
