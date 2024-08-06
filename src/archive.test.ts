import {describe} from 'node:test';

import {ArchiveTest, testArchive} from './archive.spec.ts';

void describe('archive', () => {
	void describe('Archive', () => {
		testArchive(ArchiveTest, ['dummy.file'], false, s => s);
	});
});
