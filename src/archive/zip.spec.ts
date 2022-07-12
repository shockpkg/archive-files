import {join as pathJoin} from 'path';

import {specFixturesPath, testArchive} from '../archive.spec';

import {ArchiveZip} from './zip';

describe('archive/zip', () => {
	describe('ArchiveZip', () => {
		it('file extensions', () => {
			expect(ArchiveZip.FILE_EXTENSIONS).toEqual(['.zip']);
		});

		testArchive(
			ArchiveZip,
			[
				'test-archive-zip.zip',
				'test-archive-7z.zip',
				'test-archive-ditto.zip'
			].map(s => pathJoin(specFixturesPath, s)),
			false
		);
	});
});
