import {join as pathJoin} from 'path';

import {
	specFixturesPath,
	testArchive
} from '../archive.spec';

import {ArchiveTar} from './tar';

describe('archives/tar', () => {
	describe('ArchiveTar', () => {
		testArchive(
			ArchiveTar,
			[
				'test-archive-gtar.tar'
			].map(s => pathJoin(specFixturesPath, s)),
			false
		);
	});
});
