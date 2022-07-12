import {join as pathJoin} from 'path';

import {specFixturesPath, testArchive} from '../archive.spec';

import {ArchiveTar} from './tar';

describe('archive/tar', () => {
	describe('ArchiveTar', () => {
		it('file extensions', () => {
			expect(ArchiveTar.FILE_EXTENSIONS).toEqual(['.tar']);
		});

		testArchive(
			ArchiveTar,
			['test-archive-gtar.tar'].map(s => pathJoin(specFixturesPath, s)),
			false
		);
	});
});
