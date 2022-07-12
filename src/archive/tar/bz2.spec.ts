import {join as pathJoin} from 'path';

import {specFixturesPath, testArchive} from '../../archive.spec';

import {ArchiveTarBz2} from './bz2';

describe('archive/tar/bz2', () => {
	describe('ArchiveTarBz2', () => {
		it('file extensions', () => {
			expect(ArchiveTarBz2.FILE_EXTENSIONS).toEqual([
				'.tar.bz2',
				'.tbz2'
			]);
		});

		testArchive(
			ArchiveTarBz2,
			['test-archive-gtar.tar.bz2'].map(s =>
				pathJoin(specFixturesPath, s)
			),
			false
		);
	});
});
