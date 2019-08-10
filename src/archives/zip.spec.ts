/* eslint-env jasmine */

import {join as pathJoin} from 'path';

import {
	specFixturesPath,
	testArchive
} from '../archive.spec';

import {ArchiveZip} from './zip';

describe('archives/zip', () => {
	describe('ArchiveZip', () => {
		testArchive(
			ArchiveZip,
			[
				'test-archive-zip.zip',
				'test-archive-7z.zip',
				'test-archive-ditto.zip'
			].map(s => pathJoin(specFixturesPath, s))
		);
	});
});
