import {join as pathJoin} from 'path';

import {
	ArchiveTest,
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
				await archive.read(async info => {
					const dest = pathJoin(specTmpArchivePath, info.path);
					await info.extract(dest);
				});
			}
		);
	});
});
