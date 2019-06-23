import {join as pathJoin} from 'path';

import {
	specFixturesPath,
	testArchive
} from '../../archive.spec';

import {ArchiveTarBz2} from './bz2';

describe('archives/tar/bz2', () => {
	describe('ArchiveTarGz', () => {
		testArchive(
			ArchiveTarBz2,
			[
				'test-archive-gtar.tar.bz2'
			].map(s => pathJoin(specFixturesPath, s))
		);
	});
});
