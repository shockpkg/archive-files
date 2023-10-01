import {describe, it} from 'node:test';
import {deepStrictEqual} from 'node:assert';
import {join as pathJoin} from 'node:path';

import {specFixturesPath, testArchive} from '../../archive.spec';

import {ArchiveTarBz2} from './bz2';

void describe('archive/tar/bz2', () => {
	void describe('ArchiveTarBz2', () => {
		void it('file extensions', () => {
			deepStrictEqual(ArchiveTarBz2.FILE_EXTENSIONS, [
				'.tar.bz2',
				'.tbz2'
			]);
		});

		testArchive(ArchiveTarBz2, ['test-archive-gtar.tar.bz2'], false, s =>
			pathJoin(specFixturesPath, s)
		);
	});
});
