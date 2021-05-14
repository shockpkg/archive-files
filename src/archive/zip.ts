/* eslint-disable max-classes-per-file */

import {promisify} from 'util';

import yauzl from 'yauzl';

import {
	Archive,
	Entry,
	IEntryInfo
} from '../archive';
import {
	PathType
} from '../types';
import {
	streamToBuffer,
	streamToReadable,
	zipEfaToUnixMode,
	zipPathIsMacResource,
	zipPathTypeFromEfaAndPath
} from '../util';

const yauzlOpenP = promisify(yauzl.open) as any as (
	path: string,
	options: yauzl.Options
) => Promise<yauzl.ZipFile>;

const yauzlEntryReadP = async (
	zipfile: yauzl.ZipFile,
	entry: yauzl.Entry
) => {
	// If the entry is empty, just return an empty stream.
	if (!entry.uncompressedSize) {
		return null;
	}

	const openP = promisify(zipfile.openReadStream.bind(zipfile));
	const opened = await openP(entry);
	return streamToReadable(opened);
};

const yauzlEntryReadSymlinkP = async (
	zipfile: yauzl.ZipFile,
	entry: yauzl.Entry
) => {
	const stream = await yauzlEntryReadP(zipfile, entry);
	return stream ? streamToBuffer(stream, 'end') : Buffer.alloc(0);
};

export interface IZipEntryExtraField {

	/**
	 * Field ID.
	 */
	id: number;

	/**
	 * Field data.
	 */
	data: Buffer;
}

export interface IEntryInfoZip extends IEntryInfo {

	/**
	 * Entry archive.
	 */
	archive: ArchiveZip;

	/**
	 * Entry size.
	 */
	size: number;

	/**
	 * Entry size, compressed.
	 */
	sizeComp: number;

	/**
	 * Entry uid.
	 */
	uid?: null;

	/**
	 * Entry gid.
	 */
	gid?: null;

	/**
	 * Entry uname.
	 */
	uname?: null;

	/**
	 * Entry gname.
	 */
	gname?: null;

	/**
	 * Entry atime.
	 */
	atime?: null;

	/**
	 * Entry mtime.
	 */
	mtime: Date;

	/**
	 * Entry CRC32.
	 */
	crc32: number;

	/**
	 * Entry compression method.
	 */
	compressionMethod: number;

	/**
	 * Entry is compressed flag.
	 */
	isCompressed: boolean;

	/**
	 * Entry is encrypted flag.
	 */
	isEncrypted: boolean;

	/**
	 * Entry version made by.
	 */
	versionMadeBy: number;

	/**
	 * Entry version needed to extract.
	 */
	versionNeededToExtract: number;

	/**
	 * Entry general purpose bit flags.
	 */
	generalPurposeBitFlag: number;

	/**
	 * Entry internal file attributes.
	 */
	internalFileAttributes: number;

	/**
	 * Entry external file attributes.
	 */
	externalFileAttributes: number;

	/**
	 * Entry comment.
	 */
	comment: string;

	/**
	 * Entry extra fields.
	 */
	extraFields: IZipEntryExtraField[];

	/**
	 * Read rsrc.
	 */
	readRsrc?: null;
}

/**
 * EntryZip constructor.
 *
 * @param info Info object.
 */
export class EntryZip extends Entry {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveZip;

	/**
	 * Entry size.
	 */
	public readonly size: number;

	/**
	 * Entry size, compressed.
	 */
	public readonly sizeComp: number;

	/**
	 * Entry uid.
	 */
	public readonly uid: null = null;

	/**
	 * Entry gid.
	 */
	public readonly gid: null = null;

	/**
	 * Entry uname.
	 */
	public readonly uname: null = null;

	/**
	 * Entry gname.
	 */
	public readonly gname: null = null;

	/**
	 * Entry atime.
	 */
	public readonly atime: null = null;

	/**
	 * Entry mtime.
	 */
	public readonly mtime: Date;

	/**
	 * Entry CRC32.
	 */
	public readonly crc32: number;

	/**
	 * Entry compression method.
	 */
	public readonly compressionMethod: number;

	/**
	 * Entry is compressed flag.
	 */
	public readonly isCompressed: boolean;

	/**
	 * Entry is encrypted flag.
	 */
	public readonly isEncrypted: boolean;

	/**
	 * Entry version made by.
	 */
	public readonly versionMadeBy: number;

	/**
	 * Entry version needed to extract.
	 */
	public readonly versionNeededToExtract: number;

	/**
	 * Entry general purpose bit flags.
	 */
	public readonly generalPurposeBitFlag: number;

	/**
	 * Entry internal file attributes.
	 */
	public readonly internalFileAttributes: number;

	/**
	 * Entry external file attributes.
	 */
	public readonly externalFileAttributes: number;

	/**
	 * Entry comment.
	 */
	public readonly comment: string;

	/**
	 * Entry extra fields.
	 */
	public readonly extraFields: IZipEntryExtraField[];

	/**
	 * Read rsrc.
	 */
	protected readonly _readRsrc: null = null;

	constructor(info: Readonly<IEntryInfoZip>) {
		super(info);

		this.archive = info.archive;
		this.size = info.size;
		this.sizeComp = info.sizeComp;
		this.mtime = info.mtime;
		this.crc32 = info.crc32;
		this.compressionMethod = info.compressionMethod;
		this.isCompressed = info.isCompressed;
		this.isEncrypted = info.isEncrypted;
		this.versionMadeBy = info.versionMadeBy;
		this.versionNeededToExtract = info.versionNeededToExtract;
		this.comment = info.comment;
		this.generalPurposeBitFlag = info.generalPurposeBitFlag;
		this.internalFileAttributes = info.internalFileAttributes;
		this.externalFileAttributes = info.externalFileAttributes;
		this.extraFields = info.extraFields;
	}
}

/**
 * ArchiveZip constructor.
 *
 * @param path File path.
 */
export class ArchiveZip extends Archive {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = [
		'.zip'
	];

	constructor(path: string) {
		super(path);
	}

	/**
	 * Get stat mode value from ZIP file external file attributes.
	 *
	 * @param value Attributes value.
	 * @returns Stat mode or null.
	 */
	public zipEfaToUnixMode(value: number) {
		return zipEfaToUnixMode(value);
	}

	/**
	 * Get path type from mode and path value from ZIP file entry.
	 *
	 * @param mode Entry mode.
	 * @param path Entry path.
	 * @returns Path type.
	 */
	public zipPathTypeFromEfaAndPath(mode: number, path: string) {
		return zipPathTypeFromEfaAndPath(mode, path);
	}

	/**
	 * Check if path is a Mac resource fork related path.
	 *
	 * @param path Zip path.
	 * @returns Boolean value.
	 */
	public zipPathIsMacResource(path: string) {
		return zipPathIsMacResource(path);
	}

	/**
	 * Read archive.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryZip) => Promise<any>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(
		itter: (entry: EntryZip) => Promise<any>
	) {
		const zipfile = await yauzlOpenP(this.path, {lazyEntries: true});

		const each = async (yentry: yauzl.Entry) => {
			const {
				comment,
				compressedSize,
				compressionMethod,
				crc32,
				externalFileAttributes,
				extraFields,
				fileName,
				generalPurposeBitFlag,
				internalFileAttributes,
				uncompressedSize,
				versionMadeBy,
				versionNeededToExtract
			} = yentry;

			const type = this.zipPathTypeFromEfaAndPath(
				externalFileAttributes,
				fileName
			);
			if (type === null) {
				return false;
			}

			// Mac resource fork paths currently unsupported, so skip.
			// The actual file format is unknown.
			const isMacResource = this.zipPathIsMacResource(fileName);
			if (isMacResource) {
				return false;
			}

			const mode = this.zipEfaToUnixMode(externalFileAttributes);
			const lastModDate = yentry.getLastModDate();
			const isCompressed = yentry.isCompressed();
			const isEncrypted = yentry.isEncrypted();

			const readData = type === PathType.FILE ?
				async () => yauzlEntryReadP(zipfile, yentry) : null;

			const readSymlink = type === PathType.SYMLINK ?
				async () => yauzlEntryReadSymlinkP(zipfile, yentry) : null;

			const entry = new EntryZip({
				archive: this,
				type,
				pathRaw: fileName,
				size: uncompressedSize,
				sizeComp: compressedSize,
				mode,
				mtime: lastModDate,
				crc32,
				compressionMethod,
				isCompressed,
				isEncrypted,
				versionMadeBy,
				versionNeededToExtract,
				generalPurposeBitFlag,
				internalFileAttributes,
				externalFileAttributes,
				comment,
				extraFields,
				readData,
				readSymlink
			});
			const ret = await entry.trigger(itter);
			return ret === false;
		};

		await new Promise<void>((resolve, reject) => {
			let error: Error | null = null;
			const next = (err: Error | null) => {
				if (err) {
					error = err;
					zipfile.close();
					return;
				}
				zipfile.readEntry();
			};
			zipfile.on('error', next);
			zipfile.on('entry', async (entry: yauzl.Entry) => {
				let done = false;
				try {
					done = await each(entry);
				}
				catch (err) {
					next(err);
					return;
				}

				if (done) {
					zipfile.close();
				}
				else {
					next(null);
					return;
				}
			});
			zipfile.on('close', () => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
			next(null);
		});
	}
}
