/* eslint-disable max-classes-per-file */

import {
	Readable,
	Transform
} from 'stream';

import fse from 'fs-extra';
import itPipe from 'it-pipe';
// @ts-ignore
import itTar from 'it-tar';

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

// Create stream from a BufferList generator.
const streamFromBufferListGenerator = (gen: AsyncGenerator) => {
	const r = new Readable({
		read: () => {
			gen.next()
				.then(({done, value}) => {
					r.push(done ? null : value.slice());
				},
				err => {
					r.emit('error', err);
				});
		}
	});
	return r;
};

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
	public static readonly FILE_EXTENSIONS: string[] | null = [
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
		const each = async (
			header: any,
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

			// These values should always be set.
			const pathRaw = header.name as string;
			let size = header.size as number;
			const mode = header.mode as number;
			const uid = header.uid as number;
			const gid = header.gid as number;
			const mtime = header.mtime as Date;
			const uname = header.uname as string;
			const gname = header.gname as string;

			// Used for symbolic links, convert to a buffer.
			const linkname = defaultNull(header.linkname);
			const linknameBuffer = linkname === null ?
				null : Buffer.from(linkname, 'utf8');

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
			return ret === false;
		};

		// List all the pipes.
		const streams = [
			fse.createReadStream(this.path),
			...this._decompressionTransforms()
		];

		// Create the extract handlers.
		let cancel = false;
		const extract = itTar.extract();
		const extracter = async (source: any) => {
			for await (const {header, body} of source) {
				// Call handler for each, break off on cancel.
				cancel = await each(
					header,
					() => streamFromBufferListGenerator(body)
				);
				if (cancel) {
					return;
				}

				// Finish reading the body if not read.
				// eslint-disable-next-line no-await-in-loop
				while (!(await body.next()).done) {
					// Do nothing.
				}
			}
		};

		// If more than one stream, setup a pipeline.
		if (streams.length > 1) {
			const last = streams[streams.length - 1];
			const piped = (streamPipeline as any)(...streams);
			await itPipe(streamToReadable(last), extract, extracter);

			// On cancel, destroy pipeline, ignore any errors from doing that.
			if (cancel) {
				last.destroy();
			}
			try {
				await piped;
			}
			catch (err) {
				if (!cancel) {
					throw err;
				}
			}
		}
		else {
			await itPipe(streams[0], extract, extracter);
			if (cancel) {
				streams[0].destroy();
			}
		}
	}

	/**
	 * Get decompression transform streams.
	 *
	 * @returns List of decompression transforms.
	 */
	protected _decompressionTransforms(): Transform[] {
		return [];
	}
}
