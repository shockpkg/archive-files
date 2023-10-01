import {describe} from 'node:test';

import {ArchiveTest, testArchive} from './archive.spec';

void describe('archive', () => {
	void describe('Archive', () => {
		testArchive(ArchiveTest, ['dummy.file'], false, s => s);
	});
});
