import {describe, it} from 'node:test';
import {deepStrictEqual} from 'node:assert';
import {join as pathJoin} from 'node:path';

import {platformIsMac, specFixturesPath, testArchive} from '../archive.spec';

import {ArchiveHdi} from './hdi';

void describe('archive/hdi', () => {
	void describe('ArchiveHdi', () => {
		void it('file extensions', () => {
			deepStrictEqual(ArchiveHdi.FILE_EXTENSIONS, [
				'.dmg',
				'.iso',
				'.cdr'
			]);
		});

		testArchive(
			ArchiveHdi,
			platformIsMac
				? [
						// 'test-archive-hybrid.iso',
						// 'test-archive-hfsp.dmg',
						// 'test-archive-hfsp-j.dmg',
						// 'test-archive-hfsp-c.dmg',
						// 'test-archive-hfsp-j-c.dmg',
						// 'test-archive-apfs.dmg',
						// 'test-archive-apfs-c.dmg'
				  ]
				: [],
			true,
			s => pathJoin(specFixturesPath, s)
		);
	});
});
