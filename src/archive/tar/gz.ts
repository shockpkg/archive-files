import {createGunzip} from 'node:zlib';

import {ArchiveTar} from '../tar';

/**
 * ArchiveTarGz object.
 */
export class ArchiveTarGz extends ArchiveTar {
	/**
	 * @inheritdoc
	 */
	public static readonly FILE_EXTENSIONS: readonly string[] | null = [
		'.tar.gz',
		'.tgz'
	];

	/**
	 * ArchiveTarGz constructor.
	 *
	 * @param path File path.
	 */
	constructor(path: string) {
		super(path);
	}

	/**
	 * @inheritDoc
	 */
	protected async *_decompress(input: AsyncGenerator<Buffer>) {
		const gz = createGunzip();
		const datas: Buffer[] = [];
		gz.on('data', (data: Buffer) => {
			datas.push(data);
		});
		for await (const chunk of input) {
			while (datas.length) {
				yield datas.shift() as Buffer;
			}
			await new Promise<void>((resolve, reject) => {
				gz.write(chunk, err => {
					if (err) {
						reject(err);
						return;
					}
					resolve();
				});
			});
			while (datas.length) {
				yield datas.shift() as Buffer;
			}
		}
		while (datas.length) {
			yield datas.shift() as Buffer;
		}
		await new Promise<void>((resolve, reject) => {
			gz.once('end', resolve);
			gz.once('error', reject);
			gz.end();
		});
		while (datas.length) {
			yield datas.shift() as Buffer;
		}
	}
}
