import {describe, it} from 'node:test';
import {ok, strictEqual} from 'node:assert';

import {createArchiveByFileExtension} from './create.ts';

void describe('create', () => {
	void describe('createArchiveByFileExtension', () => {
		void it('file.zip', () => {
			ok(createArchiveByFileExtension('file.zip'));
		});

		void it('file.zIp', () => {
			ok(createArchiveByFileExtension('file.zIp'));
		});

		void it('file.unknown', () => {
			strictEqual(createArchiveByFileExtension('file.unknown'), null);
		});

		void it('file', () => {
			strictEqual(createArchiveByFileExtension('file'), null);
		});
	});
});
