import {describe, it} from 'node:test';
import {deepStrictEqual} from 'node:assert';
import {join as pathJoin} from 'node:path';

import {specFixturesPath, testArchive} from '../archive.spec.ts';

import {ArchiveZip} from './zip.ts';

void describe('archive/zip', () => {
	void describe('ArchiveZip', () => {
		void it('file extensions', () => {
			deepStrictEqual(ArchiveZip.FILE_EXTENSIONS, ['.zip']);
		});

		testArchive(
			ArchiveZip,
			[
				'test-archive-zip.zip',
				'test-archive-7z.zip',
				'test-archive-ditto.zip'
			],
			false,
			s => pathJoin(specFixturesPath, s)
		);
	});
});
