/* eslint-disable max-classes-per-file */

import {Readable} from 'node:stream';

import yauzl from 'yauzl';

import {Archive, Entry, IEntryInfo} from '../archive.ts';
import {PathType} from '../types.ts';
import {modeToPathType, streamToBuffer} from '../util.ts';

/**
 * Read entry.
 *
 * @param zipfile Zipfile.
 * @param entry Entry.
 * @returns Readable stream.
 */
const yauzlEntryRead = async (zipfile: yauzl.ZipFile, entry: yauzl.Entry) => {
	// If the entry is empty, just return an empty stream.
	if (!entry.uncompressedSize) {
		return null;
	}

	return new Promise<Readable>((resolve, reject) => {
		zipfile.openReadStream(entry, (err, stream) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(stream);
		});
	});
};

/**
 * Read entry as symlink.
 *
 * @param zipfile Zipfile.
 * @param entry Entry.
 * @returns Buffer.
 */
const yauzlEntryReadSymlink = async (
	zipfile: yauzl.ZipFile,
	entry: yauzl.Entry
) => {
	const stream = await yauzlEntryRead(zipfile, entry);
	return stream ? streamToBuffer(stream) : Buffer.alloc(0);
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
	 * @inheritdoc
	 */
	archive: ArchiveZip;

	/**
	 * @inheritdoc
	 */
	size: number;

	/**
	 * @inheritdoc
	 */
	sizeComp: number;

	/**
	 * @inheritdoc
	 */
	uid?: null;

	/**
	 * @inheritdoc
	 */
	gid?: null;

	/**
	 * @inheritdoc
	 */
	uname?: null;

	/**
	 * @inheritdoc
	 */
	gname?: null;

	/**
	 * @inheritdoc
	 */
	atime?: null;

	/**
	 * @inheritdoc
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
	 * @inheritdoc
	 */
	readRsrc?: null;
}

/**
 * EntryZip object.
 */
export class EntryZip extends Entry {
	/**
	 * @inheritdoc
	 */
	public readonly archive: ArchiveZip;

	/**
	 * @inheritdoc
	 */
	public readonly size: number;

	/**
	 * @inheritdoc
	 */
	public readonly sizeComp: number;

	/**
	 * @inheritdoc
	 */
	public readonly uid: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly gid: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly uname: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly gname: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly atime: null = null;

	/**
	 * @inheritdoc
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
	 * @inheritdoc
	 */
	protected readonly _readRsrc: null = null;

	/**
	 * EntryZip constructor.
	 *
	 * @param info Info object.
	 */
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
 * ArchiveZip object.
 */
export class ArchiveZip extends Archive {
	/**
	 * @inheritdoc
	 */
	public static readonly FILE_EXTENSIONS: readonly string[] | null = ['.zip'];

	/**
	 * @inheritdoc
	 */
	public readonly Entry = EntryZip;

	/**
	 * ArchiveZip constructor.
	 *
	 * @param path File path.
	 */
	constructor(path: string) {
		super(path);
	}

	/**
	 * @inheritdoc
	 */
	public async read(itter: (entry: EntryZip) => Promise<unknown>) {
		await super.read(itter as Parameters<Archive['read']>[0]);
	}

	/**
	 * @inheritdoc
	 */
	protected async _read(itter: (entry: EntryZip) => Promise<unknown>) {
		const Static = this.constructor as typeof ArchiveZip;

		const zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
			yauzl.open(this.path, {lazyEntries: true}, (err, zipfile) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(zipfile);
			});
		});

		/**
		 * Each itterator.
		 *
		 * @param yentry Entry.
		 * @returns Recursion hint.
		 */
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

			const type = Static.efaOrPathToPathType(
				externalFileAttributes,
				fileName
			);
			if (type === null) {
				return false;
			}

			// Mac resource fork paths currently unsupported, so skip.
			// The actual file format is unknown.
			const isMacResource = Static.pathIsMacResource(fileName);
			if (isMacResource) {
				return false;
			}

			const mode = Static.efaToUnixMode(externalFileAttributes);
			const lastModDate = yentry.getLastModDate();
			const isCompressed = yentry.isCompressed();
			const isEncrypted = yentry.isEncrypted();

			const readData =
				type === PathType.FILE
					? async () => yauzlEntryRead(zipfile, yentry)
					: null;

			const readSymlink =
				type === PathType.SYMLINK
					? async () => yauzlEntryReadSymlink(zipfile, yentry)
					: null;

			const entry = new this.Entry({
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

			/**
			 * Next callback.
			 *
			 * @param err Error object or null.
			 */
			const next = (err: Error | null) => {
				if (err) {
					error = err;
					zipfile.close();
					return;
				}
				zipfile.readEntry();
			};
			zipfile.on('error', next);
			zipfile.on('entry', (entry: yauzl.Entry) => {
				each(entry)
					.then(done => {
						if (!done) {
							next(null);
							return;
						}
						zipfile.close();
					})
					.catch(next);
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

	/**
	 * Get Unix bits from the ZIP file external file attributes.
	 *
	 * @param attrs Attributes value.
	 * @returns Unix bits or null.
	 */
	public static efaToUnix(attrs: number) {
		// eslint-disable-next-line no-bitwise
		return attrs >>> 16;
	}

	/**
	 * Get stat mode value from ZIP file external file attributes, if present.
	 *
	 * @param attrs Attributes value.
	 * @returns Stat mode or null.
	 */
	public static efaToUnixMode(attrs: number) {
		const mode = this.efaToUnix(attrs);

		// Check if type bits are present, else no Unix info.
		// eslint-disable-next-line no-bitwise
		return (mode >> 12) & 0b1111 ? mode : null;
	}

	/**
	 * Get path type from attributes and path value from ZIP file entry.
	 *
	 * @param attrs Attributes value.
	 * @param path Entry path.
	 * @returns Path type.
	 */
	public static efaOrPathToPathType(attrs: number, path: string) {
		// Check for Unix stat type information.
		const mode = this.efaToUnixMode(attrs);
		if (!mode) {
			// No Unix type information, assume Windows info only.
			// Only file or directory, with directory having a trailing slash.
			return /[/\\]$/.test(path) ? PathType.DIRECTORY : PathType.FILE;
		}
		return modeToPathType(mode);
	}

	/**
	 * Check if path is a Mac resource fork related path.
	 *
	 * @param path Zip path.
	 * @returns Boolean value.
	 */
	public static pathIsMacResource(path: string) {
		return /^__MACOSX(\\|\/|$)/.test(path);
	}
}
