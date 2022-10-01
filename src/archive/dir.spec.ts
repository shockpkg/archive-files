import {chmod, mkdir} from 'fs/promises';
import {join as pathJoin} from 'path';

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
				await mkdir(unreadable, {recursive: true});
				await chmod(unreadable, 0);
			});

			const a = new ArchiveDir(specTmpArchivePath);
			const subpaths = ['file.txt', 'directory'];
			if (!platformIsWin) {
				subpaths.push('symlink');
			}
			a.subpaths = subpaths;
			const filePaths: string[] = [];
			// eslint-disable-next-line @typescript-eslint/require-await
			await a.read(async entry => {
				filePaths.push(entry.path);
			});

			const expected = [
				'file.txt',
				'directory',
				pathJoin('directory', 'subfile.txt')
			];
			if (!platformIsWin) {
				expected.push('symlink');
			}
			expect(filePaths).toEqual(expected);
		});
	});
});
