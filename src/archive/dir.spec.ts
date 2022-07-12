import {join as pathJoin} from 'path';

import fse from 'fs-extra';

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
		it('file extensions', () => {
			expect(ArchiveDir.FILE_EXTENSIONS).toBe(null);
		});

		testArchive(ArchiveDir, [specTmpArchivePath], true, async () => {
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
				const unreadable = pathJoin(specTmpArchivePath, 'unreadable');
				await fse.ensureDir(unreadable);
				await fse.chmod(unreadable, 0);
			});
		});
	});
});
