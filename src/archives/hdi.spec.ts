/* eslint-env jasmine */

import {join as pathJoin} from 'path';

import {
	platformIsMac,
	specFixturesPath,
	testArchive
} from '../archive.spec';

import {ArchiveHdi} from './hdi';

describe('archives/hdi', () => {
	describe('ArchiveHdi', () => {
		testArchive(
			ArchiveHdi,
			platformIsMac ? [
				'test-archive-hybrid.iso',
				'test-archive-hfsp.dmg',
				'test-archive-hfsp-j.dmg',
				'test-archive-hfsp-c.dmg',
				'test-archive-hfsp-j-c.dmg',
				'test-archive-apfs.dmg',
				'test-archive-apfs-c.dmg'
			].map(s => pathJoin(specFixturesPath, s)) : null
		);
	});
});
