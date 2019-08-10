/* eslint-env jasmine */

import {
	fsLstatExists,
	pathNormalize
} from './util';

describe('util', () => {
	describe('pathNormalize', () => {
		it('backslashes', () => {
			expect(pathNormalize('\\')).toBe('/');
			expect(pathNormalize('\\test\\123')).toBe('/test/123');
		});

		it('trailing slash', () => {
			expect(pathNormalize('/')).toBe('/');
			expect(pathNormalize('/test')).toBe('/test');
			expect(pathNormalize('/test/')).toBe('/test');
		});
	});

	describe('fsLstatExists', () => {
		it('file', async () => {
			const stat = await fsLstatExists(
				'spec/this-file-does-not-exist'
			);
			expect(stat).toBeNull();
		});
		it('dir', async () => {
			const stat = await fsLstatExists(
				'spec/this-dir-does-not-exist/file.txt'
			);
			expect(stat).toBeNull();
		});
		it('file as dir', async () => {
			const stat = await fsLstatExists(
				'spec/fixtures/files/lorem.txt/dir'
			);
			expect(stat).toBeNull();
		});
	});
});
