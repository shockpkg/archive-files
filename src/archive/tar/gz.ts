/* eslint-disable max-classes-per-file */

import {createGunzip} from 'node:zlib';

import {ArchiveTar, EntryTar, IEntryInfoTar} from '../tar';

export interface IEntryInfoTarGz extends IEntryInfoTar {
	/**
	 * Entry archive.
	 */
	archive: ArchiveTarGz;
}

/**
 * EntryTarGz object.
 */
export class EntryTarGz extends EntryTar {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveTarGz;

	/**
	 * EntryTarGz constructor.
	 *
	 * @param info Info object.
	 */
	constructor(info: Readonly<IEntryInfoTarGz>) {
		super(info);

		this.archive = info.archive;
	}
}

/**
 * ArchiveTarGz object.
 */
export class ArchiveTarGz extends ArchiveTar {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static readonly FILE_EXTENSIONS: string[] | null = [
		'.tar.gz',
		'.tgz'
	];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTarGz;

	/**
	 * ArchiveTarGz constructor.
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
	public async read(itter: (entry: EntryTarGz) => Promise<unknown>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(itter: (entry: EntryTarGz) => Promise<unknown>) {
		await super._read(itter);
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
