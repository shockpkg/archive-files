import {describe, it} from 'node:test';
import {deepStrictEqual, strictEqual} from 'node:assert';
import {chmod, mkdir} from 'node:fs/promises';
import {join as pathJoin} from 'node:path';

import {
	ArchiveTest,
	platformIsWin,
	safeToExtract,
	testArchive
} from '../archive.spec';
import {PathType} from '../types';

import {ArchiveDir} from './dir';

void describe('archive/dir', () => {
	void describe('ArchiveDir', () => {
		void it('file extensions', () => {
			strictEqual(ArchiveDir.FILE_EXTENSIONS, null);
		});

		testArchive(ArchiveDir, ['archive'], true, async (path, tmpdir) => {
			const archiveDir = pathJoin(tmpdir, path);
			await mkdir(archiveDir, {recursive: true});

			// Extract test archive for dummy contents.
			const archive = new ArchiveTest('dummy.file');
			await archive.read(async entry => {
				if (!safeToExtract(entry)) {
					return;
				}
				const dest = pathJoin(archiveDir, entry.path);
				await entry.extract(dest);

				if (platformIsWin) {
					return;
				}
				const unreadable = pathJoin(archiveDir, 'unreadable');
				await mkdir(unreadable, {recursive: true});
				await chmod(unreadable, 0);
			});

			// Test subpaths.
			const a = new ArchiveDir(archiveDir);
			const subpaths = ['file.txt', 'directory'];
			if (!platformIsWin) {
				subpaths.push('symlink');
			}
			a.subpaths = subpaths;

			const filePaths: [string, PathType][] = [];
			// eslint-disable-next-line @typescript-eslint/require-await
			await a.read(async entry => {
				filePaths.push([entry.path, entry.type]);
			});

			const expected: [string, PathType][] = [
				['file.txt', PathType.FILE],
				['directory', PathType.DIRECTORY],
				['directory/subfile.txt', PathType.FILE]
			];
			if (!platformIsWin) {
				expected.push(['symlink', PathType.SYMLINK]);
			}
			deepStrictEqual(filePaths, expected);

			// Proceed with other tests.
			return archiveDir;
		});
	});
});
