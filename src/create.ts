import {stat} from 'node:fs/promises';

import {Archive} from './archive';
import {ArchiveDir} from './archive/dir';
import {ArchiveHdi} from './archive/hdi';
import {ArchiveTar} from './archive/tar';
import {ArchiveTarBz2} from './archive/tar/bz2';
import {ArchiveTarGz} from './archive/tar/gz';
import {ArchiveZip} from './archive/zip';

export interface ICreateArchiveOptions {
	/**
	 * Set the nobrowse option on mounted disk images.
	 *
	 * @default false
	 */
	nobrowse?: boolean;
}

const archives: (typeof Archive)[] = [
	ArchiveDir,
	ArchiveHdi,
	ArchiveTar,
	ArchiveTarBz2,
	ArchiveTarGz,
	ArchiveZip
];

interface IArchiveExt {
	/**
	 * Archive constructor.
	 */
	Archive: typeof Archive;

	/**
	 * File extension.
	 */
	ext: string;
}

let archivesExtensionsCache: IArchiveExt[] | null = null;

/**
 * Get all archive and extension pairs, ordered longest to shortest.
 *
 * @returns List of archive and extenion pairs.
 */
function archivesExtensions() {
	if (archivesExtensionsCache) {
		return archivesExtensionsCache;
	}

	// List all the extension and archive pairs.
	const all: IArchiveExt[] = [];
	for (const Archive of archives) {
		const {FILE_EXTENSIONS} = Archive;
		if (!FILE_EXTENSIONS) {
			continue;
		}
		for (const ext of FILE_EXTENSIONS) {
			all.push({
				Archive,
				ext: ext.toLowerCase()
			});
		}
	}

	// Match longest extensions first.
	all.sort((a, b) => b.ext.length - a.ext.length);
	return (archivesExtensionsCache = all);
}

/**
 * Create an Archive instance for a given path.
 * Based on file extension.
 *
 * @param path File path.
 * @param options Optional options.
 * @returns Archive instance or null.
 */
export function createArchiveByFileExtension(
	path: string,
	options: Readonly<ICreateArchiveOptions> | null = null
) {
	const pathLower = path.toLowerCase();
	const list = archivesExtensions();
	for (const {Archive, ext} of list) {
		if (pathLower.endsWith(ext)) {
			const a = new (Archive as unknown as new (path: string) => Archive)(
				path
			);
			if (options && a instanceof ArchiveHdi) {
				a.nobrowse = options.nobrowse ?? false;
			}
			return a;
		}
	}
	return null;
}

/**
 * Create an Archive instance for a given path.
 * Based on file extension.
 *
 * @param path File path.
 * @param options Optional options.
 * @returns Archive instance.
 */
export function createArchiveByFileExtensionOrThrow(
	path: string,
	options: Readonly<ICreateArchiveOptions> | null = null
) {
	const a = createArchiveByFileExtension(path, options);
	if (!a) {
		throw new Error(`Unsupported archive format: ${path}`);
	}
	return a;
}

/**
 * Create an Archive instance for a given path.
 * Based on file extension or if a directory.
 *
 * @param path File path.
 * @param options Optional options.
 * @returns Archive instance or null.
 */
export async function createArchiveByFileStat(
	path: string,
	options: Readonly<ICreateArchiveOptions> | null = null
) {
	const st = await stat(path).catch(() => null);
	if (!st) {
		return null;
	}
	return st.isDirectory()
		? new ArchiveDir(path)
		: createArchiveByFileExtension(path, options);
}

/**
 * Create an Archive instance for a given path.
 * Based on file extension or if a directory.
 *
 * @param path File path.
 * @param options Optional options.
 * @returns Archive instance.
 */
export async function createArchiveByFileStatOrThrow(
	path: string,
	options: Readonly<ICreateArchiveOptions> | null = null
) {
	const st = await stat(path);
	return st.isDirectory()
		? new ArchiveDir(path)
		: createArchiveByFileExtensionOrThrow(path, options);
}
