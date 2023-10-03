import unbzip2Stream from 'unbzip2-stream';

import {ArchiveTar} from '../tar';

/**
 * ArchiveTarBz2 object.
 */
export class ArchiveTarBz2 extends ArchiveTar {
	/**
	 * @inheritdoc
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = [
		'.tar.bz2',
		'.tbz2'
	];

	/**
	 * ArchiveTarBz2 constructor.
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
		const bz = unbzip2Stream();
		let error: Error | null = null;

		/**
		 * This stream has no callbacks for write, listen for error.
		 *
		 * @param err Stream error.
		 */
		const onError = (err: Error) => {
			error = error || err;
		};
		bz.on('error', onError);

		const datas: Buffer[] = [];
		bz.on('data', (data: Buffer) => {
			datas.push(data);
		});
		for await (const chunk of input) {
			if (error) {
				throw error;
			}
			while (datas.length) {
				yield datas.shift() as Buffer;
			}
			bz.write(chunk);
			if (error) {
				throw error;
			}
			while (datas.length) {
				yield datas.shift() as Buffer;
			}
		}
		if (error) {
			throw error;
		}
		while (datas.length) {
			yield datas.shift() as Buffer;
		}
		bz.off('error', onError);
		await new Promise<void>((resolve, reject) => {
			bz.once('end', resolve);
			bz.once('error', reject);
			bz.end();
		});
		while (datas.length) {
			yield datas.shift() as Buffer;
		}
	}
}
