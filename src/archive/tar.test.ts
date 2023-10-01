import {describe, it} from 'node:test';
import {deepStrictEqual} from 'node:assert';
import {join as pathJoin} from 'node:path';

import {specFixturesPath, testArchive} from '../archive.spec';

import {ArchiveTar} from './tar';

void describe('archive/tar', () => {
	void describe('ArchiveTar', () => {
		void it('file extensions', () => {
			deepStrictEqual(ArchiveTar.FILE_EXTENSIONS, ['.tar']);
		});

		testArchive(ArchiveTar, ['test-archive-gtar.tar'], false, s =>
			pathJoin(specFixturesPath, s)
		);
	});
});
