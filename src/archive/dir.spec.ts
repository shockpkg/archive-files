import {join as pathJoin} from 'path';

import {
	chmod as fseLchmod,
	ensureDir as fseEnsureDir
} from 'fs-extra';

import {
	ArchiveTest,
	platformIsWin,
	safeToExtract,
	specTmpArchivePath,
	testArchive
} from '../archive.spec';

import {ArchiveDir} from './dir';

describe('archive/dir', () => {
	describe('ArchiveDir', () => {
		testArchive(
			ArchiveDir,
			[
				specTmpArchivePath
			],
			true,
			async () => {
				// Extract test archive for dummy contents.
				const archive = new ArchiveTest('dummy.file');
				await archive.read(async entry => {
					if (!safeToExtract(entry)) {
						return;
					}
					const dest = pathJoin(specTmpArchivePath, entry.path);
					await entry.extract(dest);

					if (platformIsWin) {
						return;
					}
					const unreadable = pathJoin(
						specTmpArchivePath,
						'unreadable'
					);
					await fseEnsureDir(unreadable);
					await fseLchmod(unreadable, 0);
				});
			}
		);
	});
});
