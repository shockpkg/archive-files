import {join as pathJoin} from 'path';

import {
	ArchiveTest,
	safeToExtract,
	specTmpArchivePath,
	testArchive
} from '../archive.spec';

import {ArchiveDir} from './dir';

describe('archives/dir', () => {
	describe('ArchiveDir', () => {
		testArchive(
			ArchiveDir,
			[specTmpArchivePath],
			async () => {
				// Extract test archive for dummy contents.
				const archive = new ArchiveTest('dummy.file');
				await archive.read(async entry => {
					if (!safeToExtract(entry)) {
						return;
					}
					const dest = pathJoin(specTmpArchivePath, entry.path);
					await entry.extract(dest);
				});
			}
		);
	});
});
