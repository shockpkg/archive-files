/* eslint-disable max-classes-per-file */

import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';

import {Archive, Entry, IEntryInfo} from '../archive';
import {PathType} from '../types';

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
	/**
	 * @inheritdoc
	 */
	archive: ArchiveTar;

	/**
	 * @inheritdoc
	 */
	size: number;

	/**
	 * @inheritdoc
	 */
	sizeComp?: null;

	/**
	 * @inheritdoc
	 */
	mode: number;

	/**
	 * @inheritdoc
	 */
	uid: number;

	/**
	 * @inheritdoc
	 */
	gid: number;

	/**
	 * @inheritdoc
	 */
	uname?: string;

	/**
	 * @inheritdoc
	 */
	gname?: string;

	/**
	 * @inheritdoc
	 */
	atime?: null;

	/**
	 * @inheritdoc
	 */
	mtime: Date;

	/**
	 * Entry linkname if present.
	 */
	linkname: string | null;

	/**
	 * @inheritdoc
	 */
	readRsrc?: null;
}

/**
 * EntryTar object.
 */
export class EntryTar extends Entry {
	/**
	 * @inheritdoc
	 */
	public readonly archive: ArchiveTar;

	/**
	 * @inheritdoc
	 */
	public readonly size: number;

	/**
	 * @inheritdoc
	 */
	public readonly sizeComp: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly mode: number;

	/**
	 * @inheritdoc
	 */
	public readonly uid: number;

	/**
	 * @inheritdoc
	 */
	public readonly gid: number;

	/**
	 * @inheritdoc
	 */
	public readonly uname: string | null;

	/**
	 * @inheritdoc
	 */
	public readonly gname: string | null;

	/**
	 * @inheritdoc
	 */
	public readonly atime: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly mtime: Date;

	/**
	 * Entry linkname if present.
	 */
	public readonly linkname: string | null;

	/**
	 * @inheritdoc
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
		this.uname = info.uname ?? null;
		this.gname = info.gname ?? null;
		this.mtime = info.mtime;
		this.linkname = info.linkname ?? null;
	}
}

/**
 * ArchiveTar object.
 */
export class ArchiveTar extends Archive {
	/**
	 * @inheritdoc
	 */
	public static readonly FILE_EXTENSIONS: Readonly<string[]> | null = [
		'.tar'
	];

	/**
	 * @inheritdoc
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
	 * @inheritdoc
	 */
	public async read(itter: (entry: EntryTar) => Promise<unknown>) {
		await super.read(itter as Parameters<Archive['read']>[0]);
	}

	/**
	 * @inheritdoc
	 */
	protected async _read(itter: (entry: EntryTar) => Promise<unknown>) {
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
			const linkname = header.linkname ?? null;
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
	 * @yields Decompressed data.
	 */
	protected async *_decompress(input: AsyncGenerator<Buffer>) {
		// Plain tar files are not compressed, just pass data through.
		for await (const chunk of input) {
			yield chunk;
		}
	}
}
