/* eslint-env jasmine */

import {
	createArchiveByFileExtension
} from './create';

describe('create', () => {
	describe('createArchiveByFileExtension', () => {
		it('file.zip', () => {
			expect(createArchiveByFileExtension('file.zip')).toBeTruthy();
		});

		it('file.zIp', () => {
			expect(createArchiveByFileExtension('file.zIp')).toBeTruthy();
		});

		it('file.unknown', () => {
			expect(createArchiveByFileExtension('file.unknown')).toBeNull();
		});

		it('file', () => {
			expect(createArchiveByFileExtension('file')).toBeNull();
		});
	});
});
