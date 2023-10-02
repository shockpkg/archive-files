/* eslint-disable max-classes-per-file */

import unbzip2Stream from 'unbzip2-stream';

import {ArchiveTar, EntryTar, IEntryInfoTar} from '../tar';

export interface IEntryInfoTarBz2 extends IEntryInfoTar {
	/**
	 * Entry archive.
	 */
	archive: ArchiveTarBz2;
}

/**
 * EntryTarBz2 object.
 */
export class EntryTarBz2 extends EntryTar {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveTarBz2;

	/**
	 * EntryTarBz2 constructor.
	 *
	 * @param info Info object.
	 */
	constructor(info: Readonly<IEntryInfoTarBz2>) {
		super(info);

		this.archive = info.archive;
	}
}

/**
 * ArchiveTarBz2 object.
 */
export class ArchiveTarBz2 extends ArchiveTar {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = [
		'.tar.bz2',
		'.tbz2'
	];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTarBz2;

	/**
	 * ArchiveTarBz2 constructor.
	 *
	 * @param path File path.
	 */
	constructor(path: string) {
		super(path);
	}

	/**
	 * Read archive.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryTarBz2) => Promise<unknown>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(itter: (entry: EntryTarBz2) => Promise<unknown>) {
		await super._read(itter);
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
