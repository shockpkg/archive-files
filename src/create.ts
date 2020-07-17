import {Archive} from './archive';
import {ArchiveDir} from './archives/dir';
import {ArchiveHdi} from './archives/hdi';
import {ArchiveTar} from './archives/tar';
import {ArchiveTarBz2} from './archives/tars/bz2';
import {ArchiveTarGz} from './archives/tars/gz';
import {ArchiveZip} from './archives/zip';

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
		const exts = Archive.FILE_EXTENSIONS;
		if (!exts) {
			continue;
		}
		for (const ext of exts) {
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
 * Create an Archive instance for a given path, based on file extension.
 *
 * @param path File path.
 * @returns Archive instance or null.
 */
export function createArchiveByFileExtension(path: string) {
	const pathLower = path.toLowerCase();
	const list = archivesExtensions();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	for (const {Archive, ext} of list) {
		if (pathLower.endsWith(ext)) {
			return new (Archive as any)(path) as Archive;
		}
	}
	return null;
}
