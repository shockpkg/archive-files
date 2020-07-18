import {join as pathJoin} from 'path';

import {
	specFixturesPath,
	testArchive
} from '../../archive.spec';

import {ArchiveTarGz} from './gz';

describe('archive/tar/gz', () => {
	describe('ArchiveTarGz', () => {
		testArchive(
			ArchiveTarGz,
			[
				'test-archive-gtar.tar.gz'
			].map(s => pathJoin(specFixturesPath, s)),
			false
		);
	});
});
