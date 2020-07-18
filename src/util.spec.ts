import fse from 'fs-extra';

import {
	fsLstatExists,
	pathNormalize,
	fsSymlink
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

	describe('fsSymlink', () => {
		beforeAll(async () => {
			await fse.remove('spec/tmp/symlinks');
			await fse.ensureDir('spec/tmp/symlinks');
		});
		afterAll(async () => {
			await fse.remove('spec/tmp/symlinks');
		});
		it('string+string', async () => {
			await fsSymlink(
				'spec/tmp/symlinks/string-string',
				'target'
			);
		});
		it('string+buffer', async () => {
			await fsSymlink(
				'spec/tmp/symlinks/string-buffer',
				Buffer.from('target')
			);
		});
		it('buffer+string', async () => {
			await fsSymlink(
				Buffer.from('spec/tmp/symlinks/buffer-string'),
				'target'
			);
		});
		it('buffer+buffer', async () => {
			await fsSymlink(
				Buffer.from('spec/tmp/symlinks/buffer-buffer'),
				Buffer.from('target')
			);
		});
	});
});
