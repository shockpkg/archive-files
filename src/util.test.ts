import {describe, it} from 'node:test';
import {strictEqual} from 'node:assert';
import {mkdir, rm} from 'node:fs/promises';

import {fsLstatExists, pathNormalize, fsSymlink} from './util';

async function withSymlinksDir(f: (dir: string) => unknown) {
	const dir = 'spec/tmp/symlinks';
	await rm(dir, {recursive: true, force: true});
	await mkdir(dir, {recursive: true});
	try {
		await f(dir);
	} finally {
		await rm(dir, {recursive: true, force: true});
	}
}

void describe('util', () => {
	void describe('pathNormalize', () => {
		void it('backslashes', () => {
			strictEqual(pathNormalize('\\'), '/');
			strictEqual(pathNormalize(String.raw`\test\123`), '/test/123');
		});

		void it('trailing slash', () => {
			strictEqual(pathNormalize('/'), '/');
			strictEqual(pathNormalize('/test'), '/test');
			strictEqual(pathNormalize('/test/'), '/test');
		});
	});

	void describe('fsLstatExists', () => {
		void it('file', async () => {
			const stat = await fsLstatExists('spec/this-file-does-not-exist');
			strictEqual(stat, null);
		});

		void it('dir', async () => {
			const stat = await fsLstatExists(
				'spec/this-dir-does-not-exist/file.txt'
			);
			strictEqual(stat, null);
		});

		void it('file as dir', async () => {
			const stat = await fsLstatExists(
				'spec/fixtures/files/lorem.txt/dir'
			);
			strictEqual(stat, null);
		});
	});

	void describe('fsSymlink', () => {
		void it('string+string', async () => {
			await withSymlinksDir(async dir => {
				await fsSymlink(`${dir}/string-string`, 'target');
			});
		});

		void it('string+buffer', async () => {
			await withSymlinksDir(async dir => {
				await fsSymlink(`${dir}/string-buffer`, Buffer.from('target'));
			});
		});

		void it('buffer+string', async () => {
			await withSymlinksDir(async dir => {
				await fsSymlink(Buffer.from(`${dir}/buffer-string`), 'target');
			});
		});

		void it('buffer+buffer', async () => {
			await withSymlinksDir(async dir => {
				await fsSymlink(
					Buffer.from(`${dir}/buffer-buffer`),
					Buffer.from('target')
				);
			});
		});
	});
});
