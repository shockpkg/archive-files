/* eslint-disable max-classes-per-file */

import {
	Stats
} from 'fs';
import {
	join as pathJoin
} from 'path';

import fse from 'fs-extra';

import {
	Archive,
	Entry,
	IEntryInfo
} from '../archive';
import {
	PathType
} from '../types';
import {
	fsLstatExists,
	fsReadlinkRaw,
	fsWalk,
	pathNormalize,
	pathResourceFork,
	statToPathType
} from '../util';

const walkOpts = {
	ignoreUnreadableDirectories: true
};

export interface IEntryInfoDir extends IEntryInfo {

	/**
	 * Entry archive.
	 */
	archive: ArchiveDir;

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
	uname?: null;

	/**
	 * Entry gname.
	 */
	gname?: null;

	/**
	 * Entry atime.
	 */
	atime: Date;

	/**
	 * Entry mtime.
	 */
	mtime: Date;
}

/**
 * EntryDir constructor.
 *
 * @param info Info object.
 */
export class EntryDir extends Entry {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveDir;

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
	public readonly uname: null = null;

	/**
	 * Entry gname.
	 */
	public readonly gname: null = null;

	/**
	 * Entry atime.
	 */
	public readonly atime: Date;

	/**
	 * Entry mtime.
	 */
	public readonly mtime: Date;

	constructor(info: Readonly<IEntryInfoDir>) {
		super(info);

		this.archive = info.archive;
		this.size = info.size;
		this.mode = info.mode;
		this.uid = info.uid;
		this.gid = info.gid;
		this.atime = info.atime;
		this.mtime = info.mtime;
	}

	/**
	 * Get the path of resource psuedo-file, raw.
	 *
	 * @returns Path string.
	 */
	public get rsrcPathRaw() {
		return pathResourceFork(this.pathRaw);
	}

	/**
	 * Get the path of resource psuedo-file, normalized.
	 *
	 * @returns Path string.
	 */
	public get rsrcPath() {
		return pathNormalize(pathResourceFork(this.path));
	}
}

/**
 * ArchiveDir constructor.
 *
 * @param path File path.
 */
export class ArchiveDir extends Archive {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = null;

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryDir;

	constructor(path: string) {
		super(path);
	}

	/**
	 * Read archive.
	 * If the itter callback returns false, reading ends.
	 * If the itter callback returns null, skip descent.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryDir) => Promise<any>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 * If the itter callback returns null, skip descent.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(
		itter: (entry: EntryDir) => Promise<any>
	) {
		const each = async (
			pathFull: string,
			pathRaw: string,
			stat: Stats
		) => {
			const type = statToPathType(stat);
			if (type === null) {
				return true;
			}

			const {size, mode, uid, gid, atime, mtime} = stat;

			const readData = type === PathType.FILE ?
				async () => fse.createReadStream(pathFull) : null;

			const readSymlink = type === PathType.SYMLINK ?
				async () => fsReadlinkRaw(pathFull) : null;

			const entry = new this.Entry({
				archive: this,
				type,
				pathRaw,
				size,
				mode,
				uid,
				gid,
				atime,
				mtime,
				readData,
				readSymlink
			});

			const ret = await entry.trigger(itter);
			if (ret === false) {
				return null;
			}
			if (ret === null) {
				return false;
			}

			if (type === PathType.FILE) {
				const rsrcPathFull = pathResourceFork(pathFull);
				const rsrcStat = await fsLstatExists(rsrcPathFull);

				if (rsrcStat) {
					const sizeRsrc = rsrcStat.size;

					const readRsrc =
						async () => fse.createReadStream(rsrcPathFull);

					const entryRsrc = new this.Entry({
						archive: this,
						type: PathType.RESOURCE_FORK,
						pathRaw,
						size: sizeRsrc,
						mode,
						uid,
						gid,
						atime,
						mtime,
						readRsrc
					});

					const ret = await entryRsrc.trigger(itter);
					if (ret === false) {
						return null;
					}
					if (ret === null) {
						return false;
					}
				}
			}

			return true;
		};

		const base = this.path;
		await fsWalk(base, async (pathRel, stat) => {
			const pathFull = pathJoin(base, pathRel);
			const ret = await each(pathFull, pathRel, stat);
			return ret;
		}, walkOpts);
	}
}
