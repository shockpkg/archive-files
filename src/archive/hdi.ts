/* eslint-disable max-classes-per-file */

import {Stats, createReadStream} from 'node:fs';
import {basename, join as pathJoin} from 'node:path';

import {Mounter} from '@shockpkg/hdi-mac';

import {Archive, Entry, IEntryInfo} from '../archive';
import {PathType} from '../types';
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

export interface IEntryInfoHdi extends IEntryInfo {
	/**
	 * Entry archive.
	 */
	archive: ArchiveHdi;

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
 * EntryHdi object.
 */
export class EntryHdi extends Entry {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveHdi;

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

	/**
	 * EntryHdi constructor.
	 *
	 * @param info Info object.
	 */
	constructor(info: Readonly<IEntryInfoHdi>) {
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
 * ArchiveHdi object.
 */
export class ArchiveHdi extends Archive {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = [
		'.dmg',
		'.iso',
		'.cdr'
	];

	/**
	 * Archive has named volumes that each entry will be under.
	 */
	public static readonly HAS_NAMED_VOLUMES: boolean = true;

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryHdi;

	/**
	 * Mounter, Mac.
	 */
	public mounterMac = new Mounter();

	/**
	 * Hide mounted disk image from the file explorers.
	 */
	public nobrowse = false;

	/**
	 * ArchiveHdi constructor.
	 *
	 * @param path File path.
	 */
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
	public async read(itter: (entry: EntryHdi) => Promise<unknown>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 * If the itter callback returns null, skip descent.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(itter: (entry: EntryHdi) => Promise<unknown>) {
		/**
		 * Each itterator.
		 *
		 * @param pathFull Full path.
		 * @param pathRaw Raw path.
		 * @param stat Stat object.
		 * @returns Recursion hint.
		 */
		const each = async (pathFull: string, pathRaw: string, stat: Stats) => {
			const type = statToPathType(stat);
			if (type === null) {
				return true;
			}

			const {size, mode, uid, gid, atime, mtime} = stat;

			const readData =
				type === PathType.FILE
					? // eslint-disable-next-line max-len
					  // eslint-disable-next-line @typescript-eslint/require-await
					  async () => createReadStream(pathFull)
					: null;

			const readSymlink =
				type === PathType.SYMLINK
					? async () => fsReadlinkRaw(pathFull)
					: null;

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

					/**
					 * Read RSRC.
					 *
					 * @returns Read stream.
					 */
					// eslint-disable-next-line @typescript-eslint/require-await
					const readRsrc = async () => createReadStream(rsrcPathFull);

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

		// Attach disk image, using automatic eject on shutdown (3rd arg).
		// Just in case process shutdown without reaching finally.
		const {mounterMac, nobrowse} = this;
		// eslint-disable-next-line @typescript-eslint/unbound-method
		const {devices, eject} = await mounterMac.attach(
			this.path,
			{
				nobrowse,
				readonly: true
			},
			{}
		);

		// Eject device when done.
		try {
			for (const device of devices) {
				const {mountPoint} = device;
				if (!mountPoint) {
					continue;
				}

				const volumeName = basename(mountPoint);
				// eslint-disable-next-line no-await-in-loop
				await fsWalk(
					mountPoint,
					async (pathRel, stat) => {
						const pathFull = pathJoin(mountPoint, pathRel);
						const pathRaw = pathJoin(volumeName, pathRel);
						return each(pathFull, pathRaw, stat);
					},
					walkOpts
				);
			}
		} finally {
			await eject();
		}
	}
}
