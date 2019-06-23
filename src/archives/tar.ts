import {
	createReadStream as fseCreateReadStream
} from 'fs-extra';
import {
	Readable,
	Transform
} from 'stream';
import {
	extract as tarExtract,
	Headers as TarHeaders
} from 'tar-stream';

import {
	Archive,
	Entry,
	IEntryInfo
} from '../archive';
import {property} from '../decorators';
import {
	PathType
} from '../types';
import {
	defaultNull,
	errorInternal,
	streamPipeline,
	streamToReadable
} from '../util';

export interface IEntryInfoTar extends IEntryInfo {
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
	uname: string;

	/**
	 * Entry gname.
	 */
	gname: string;

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
 * EntryTar constructor.
 *
 * @param info Info object.
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
	public readonly uname: string;

	/**
	 * Entry gname.
	 */
	public readonly gname: string;

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
	@property(false)
	protected readonly _readRsrc: null = null;

	constructor(info: IEntryInfoTar) {
		super(info);

		this.archive = info.archive;
		this.size = info.size;
		this.mode = info.mode;
		this.uid = info.uid;
		this.gid = info.gid;
		this.uname = info.uname;
		this.gname = info.gname;
		this.mtime = info.mtime;
		this.linkname = defaultNull(info.linkname);
	}
}

/**
 * ArchiveTar constructor.
 *
 * @param path File path.
 */
export class ArchiveTar extends Archive {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static FILE_EXTENSIONS: string[] | null = [
		'.tar'
	];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTar;

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
	protected async _read(
		itter: (entry: EntryTar) => Promise<any>
	) {
		let cancelError: Error | null = null;

		const each = async (
			header: TarHeaders,
			stream: () => Readable
		) => {
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

			// When extracting, the following are guaranteed not undefined.
			const pathRaw = header.name;
			let size = header.size as number;
			const mode = header.mode as number;
			const uid = header.uid as number;
			const gid = header.gid as number;
			const mtime = header.mtime as Date;
			const uname = header.uname as string;
			const gname = header.gname as string;

			// Used for symbolic links, convert to a buffer.
			const linkname = defaultNull(header.linkname);
			const linknameBuffer = linkname !== null ?
				Buffer.from(linkname, 'utf8') : null;

			const readData = type === PathType.FILE ?
				async () => stream() : null;
			const readSymlink = linknameBuffer ?
				async () => linknameBuffer : null;

			// If a symbolic link, make it the size of the link data, not 0.
			if (type === PathType.SYMLINK) {
				if (!linknameBuffer) {
					throw errorInternal();
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
			return ret === false ? true : false;
		};

		const reader = fseCreateReadStream(this.path);

		const decompressors = this._decompressionTransforms();

		const extract = tarExtract();
		extract.on('entry', async (
			header,
			stream,
			next
		) => {
			const r = streamToReadable(stream);

			// Function to forward a single error to fail extract pipeline.
			let extractErrored = false;
			const extractError = (err: any) => {
				if (!extractErrored) {
					extractErrored = true;
					extract.emit('error', err);
				}
			};

			// On any errors, fail the pipeline.
			r.on('error', extractError);

			// Once this entry ends, continue on to the next one.
			r.on('end', next);

			let continued = false;
			const read = () => {
				continued = true;
				return r;
			};

			// Handle entry, on any errors fail the pipeline.
			let cancel = false;
			try {
				cancel = await each(header, read);
			}
			catch (err) {
				extractError(err);
				return;
			}

			// If cancel, pause streams and throw cancel error.
			if (cancel) {
				r.pause();
				reader.pause();
				cancelError = new Error();
				extractError(cancelError);
				return;
			}

			// If this entry was not read by the handler, continue over it.
			if (!continued) {
				r.resume();
			}
		});

		try {
			// Pipeline type does not work with variable arguments.
			await (streamPipeline as any)(reader, ...decompressors, extract);
		}
		catch (err) {
			// If not the cancel error, throw.
			if (err !== cancelError) {
				throw err;
			}
		}
	}

	/**
	 * Get decompression transform streams.
	 *
	 * @return List of decompression transforms.
	 */
	protected _decompressionTransforms(): Transform[] {
		return [];
	}
}
