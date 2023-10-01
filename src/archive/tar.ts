/* eslint-disable max-classes-per-file */

import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';

import {Archive, Entry, IEntryInfo} from '../archive';
import {PathType} from '../types';
import {defaultNull} from '../util';

// Based on it-tar TarEntryHeader.
interface IHeader {
	name: string;
	uid: number;
	gid: number;
	size: number;
	mode: number;
	mtime: Date;
	type?: string;
	typeflag?: number;
	linkname?: string;
	uname?: string;
	gname?: string;
}

interface IBufferList {
	slice: () => Buffer;
}

/**
 * Load it-tar, even in CommonJS.
 *
 * @returns The it-tar module.
 */
const itTar = async () =>
	import('it-tar' as string) as Promise<{
		extract: () => (input: AsyncGenerator<Buffer>) => AsyncIterable<{
			header: IHeader;
			body: AsyncGenerator<IBufferList>;
		}>;
	}>;

/**
 * Create stream from a BufferList generator.
 *
 * @param gen BufferList generator.
 * @returns Readable stream.
 */
const streamFromBufferListGenerator = (gen: AsyncGenerator<IBufferList>) => {
	const r = new Readable({
		/**
		 * Read method.
		 */
		read: () => {
			gen.next().then(
				({done, value}) => {
					r.push(done ? null : value.slice());
				},
				err => {
					r.emit('error', err);
				}
			);
		}
	});
	return r;
};

export interface IEntryInfoTar extends IEntryInfo {
	//
	/**
	 * Entry archive.
	 */
	archive: ArchiveTar;

	/**
	 * Entry path, raw.
	 */
	pathRaw: string;

	/**
	 * Entry size.
	 */
	size: number;

	/**
	 * Entry size, compressed.
	 */
	sizeComp?: null;

	/**
	 * Entry mode.
	 */
	mode: number;

	/**
	 * Entry uid.
	 */
	uid: number;

	/**
	 * Entry gid.
	 */
	gid: number;

	/**
	 * Entry uname.
	 */
	uname?: string;

	/**
	 * Entry gname.
	 */
	gname?: string;

	/**
	 * Entry atime.
	 */
	atime?: null;

	/**
	 * Entry mtime.
	 */
	mtime: Date;

	/**
	 * Entry linkname if present.
	 */
	linkname: string | null;

	/**
	 * Read rsrc.
	 */
	readRsrc?: null;
}

/**
 * EntryTar object.
 */
export class EntryTar extends Entry {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveTar;

	/**
	 * Entry size.
	 */
	public readonly size: number;

	/**
	 * Entry size, compressed.
	 */
	public readonly sizeComp: null = null;

	/**
	 * Entry mode.
	 */
	public readonly mode: number;

	/**
	 * Entry uid.
	 */
	public readonly uid: number;

	/**
	 * Entry gid.
	 */
	public readonly gid: number;

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
	public readonly atime: null = null;

	/**
	 * Entry mtime.
	 */
	public readonly mtime: Date;

	/**
	 * Entry linkname if present.
	 */
	public readonly linkname: string | null;

	/**
	 * Read rsrc.
	 */
	protected readonly _readRsrc: null = null;

	/**
	 * EntryTar constructor.
	 *
	 * @param info Info object.
	 */
	constructor(info: Readonly<IEntryInfoTar>) {
		super(info);

		this.archive = info.archive;
		this.size = info.size;
		this.mode = info.mode;
		this.uid = info.uid;
		this.gid = info.gid;
		this.uname = defaultNull(info.uname);
		this.gname = defaultNull(info.gname);
		this.mtime = info.mtime;
		this.linkname = defaultNull(info.linkname);
	}
}

/**
 * ArchiveTar object.
 */
export class ArchiveTar extends Archive {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = ['.tar'];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTar;

	/**
	 * ArchiveTar constructor.
	 *
	 * @param path File path.
	 */
	constructor(path: string) {
		super(path);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryTar) => Promise<any>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(itter: (entry: EntryTar) => Promise<any>) {
		/**
		 * Each itterator.
		 *
		 * @param header Entry header.
		 * @param stream Entry stream.
		 * @returns Recursion hint.
		 */
		const each = async (header: IHeader, stream: () => Readable) => {
			// Check type, skip unsupported.
			let type: PathType;
			switch (header.type) {
				case 'file': {
					type = PathType.FILE;
					break;
				}
				case 'symlink': {
					type = PathType.SYMLINK;
					break;
				}
				case 'directory': {
					type = PathType.DIRECTORY;
					break;
				}
				default: {
					return false;
				}
			}

			// These values should always be set.
			const pathRaw = header.name;
			let {size} = header;
			const {mode, uid, gid, mtime, uname, gname} = header;

			// Used for symbolic links, convert to a buffer.
			const linkname = defaultNull(header.linkname);
			const linknameBuffer =
				linkname === null ? null : Buffer.from(linkname, 'utf8');

			const readData =
				// eslint-disable-next-line @typescript-eslint/require-await
				type === PathType.FILE ? async () => stream() : null;
			const readSymlink = linknameBuffer
				? // eslint-disable-next-line @typescript-eslint/require-await
				  async () => linknameBuffer
				: null;

			// If a symbolic link, make it the size of the link data, not 0.
			if (type === PathType.SYMLINK) {
				if (!linknameBuffer) {
					throw new Error('Internal error');
				}
				size = linknameBuffer.length;
			}

			const entry = new this.Entry({
				archive: this,
				type,
				pathRaw,
				size,
				mode,
				uid,
				gid,
				uname,
				gname,
				mtime,
				linkname,
				readData,
				readSymlink
			});
			const ret = await entry.trigger(itter);
			return ret === false;
		};

		let cancel = false;
		const input = createReadStream(this.path);
		const {extract} = await itTar();
		for await (const {header, body} of extract()(
			this._decompress(input as unknown as AsyncGenerator<Buffer>)
		)) {
			// Call handler for each, break off on cancel.
			cancel = await each(header, () =>
				streamFromBufferListGenerator(body)
			);
			if (cancel) {
				break;
			}

			// Finish reading the body if not read, get to the next entry.
			// eslint-disable-next-line no-await-in-loop
			while (!(await body.next()).done) {
				// Do nothing.
			}
		}

		if (cancel) {
			input.destroy();
		}
	}

	/**
	 * A async buffer generator to decopress if needed.
	 *
	 * @param input Buffer generator.
	 * @yields Decopressed data.
	 */
	protected async *_decompress(input: AsyncGenerator<Buffer>) {
		// Plain tar files are not compressed, just pass data through.
		for await (const chunk of input) {
			yield chunk;
		}
	}
}
