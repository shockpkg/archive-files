import {describe, it} from 'node:test';
import {deepStrictEqual} from 'node:assert';
import {join as pathJoin} from 'node:path';

import {specFixturesPath, testArchive} from '../../archive.spec';

import {ArchiveTarGz} from './gz';

void describe('archive/tar/gz', () => {
	void describe('ArchiveTarGz', () => {
		void it('file extensions', () => {
			deepStrictEqual(ArchiveTarGz.FILE_EXTENSIONS, ['.tar.gz', '.tgz']);
		});

		testArchive(ArchiveTarGz, ['test-archive-gtar.tar.gz'], false, s =>
			pathJoin(specFixturesPath, s)
		);
	});
});
