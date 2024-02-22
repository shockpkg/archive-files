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

const ejectOptions = {
	force: true
};

export interface IEntryInfoHdi extends IEntryInfo {
	/**
	 * @inheritdoc
	 */
	archive: ArchiveHdi;

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
	uname?: null;

	/**
	 * @inheritdoc
	 */
	gname?: null;

	/**
	 * @inheritdoc
	 */
	atime: Date;

	/**
	 * @inheritdoc
	 */
	mtime: Date;
}

/**
 * EntryHdi object.
 */
export class EntryHdi extends Entry {
	/**
	 * @inheritdoc
	 */
	public readonly archive: ArchiveHdi;

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
	public readonly uname: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly gname: null = null;

	/**
	 * @inheritdoc
	 */
	public readonly atime: Date;

	/**
	 * @inheritdoc
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
	 * @inheritdoc
	 */
	public static readonly FILE_EXTENSIONS: Readonly<string[]> | null = [
		'.dmg',
		'.iso',
		'.cdr'
	];

	/**
	 * @inheritdoc
	 */
	public static readonly HAS_NAMED_VOLUMES: boolean = true;

	/**
	 * @inheritdoc
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
	 * @inheritdoc
	 */
	public async read(itter: (entry: EntryHdi) => Promise<unknown>) {
		await super.read(itter as Parameters<Archive['read']>[0]);
	}

	/**
	 * @inheritdoc
	 */
	protected async _read(itter: (entry: EntryHdi) => Promise<unknown>) {
		const {mounterMac, nobrowse} = this;

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

		// Using auto-eject on normal exit option.
		const info = await mounterMac.attach(
			this.path,
			{
				nobrowse,
				readonly: true
			},
			ejectOptions
		);

		// Eject device when done.
		try {
			for (const device of info.devices) {
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
			await info.eject(ejectOptions);
		}
	}
}
