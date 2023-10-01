import {join as pathJoin} from 'path';

import {platformIsMac, specFixturesPath, testArchive} from '../archive.spec';

import {ArchiveHdi} from './hdi';

describe('archive/hdi', () => {
	describe('ArchiveHdi', () => {
		it('file extensions', () => {
			expect(ArchiveHdi.FILE_EXTENSIONS).toEqual([
				'.dmg',
				'.iso',
				'.cdr'
			]);
		});

		testArchive(
			ArchiveHdi,
			platformIsMac
				? [
						'test-archive-hybrid.iso',
						'test-archive-hfsp.dmg',
						'test-archive-hfsp-j.dmg',
						'test-archive-hfsp-c.dmg',
						'test-archive-hfsp-j-c.dmg',
						'test-archive-apfs.dmg',
						'test-archive-apfs-c.dmg'
				  ].map(s => pathJoin(specFixturesPath, s))
				: null,
			true
		);
	});
});
