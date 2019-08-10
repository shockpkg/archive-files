/* eslint-disable max-classes-per-file */

import {Transform} from 'stream';

// @ts-ignore
import unbzip2Stream from 'unbzip2-stream';

import {
	ArchiveTar,
	EntryTar,
	IEntryInfoTar
} from '../tar';

export interface IEntryInfoTarBz2 extends IEntryInfoTar {

	/**
	 * Entry archive.
	 */
	archive: ArchiveTarBz2;
}

/**
 * EntryTarBz2 constructor.
 *
 * @param info Info object.
 */
export class EntryTarBz2 extends EntryTar {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveTarBz2;

	constructor(info: IEntryInfoTarBz2) {
		super(info);

		this.archive = info.archive;
	}
}

/**
 * ArchiveTarBz2 constructor.
 *
 * @param path File path.
 */
export class ArchiveTarBz2 extends ArchiveTar {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static FILE_EXTENSIONS: string[] | null = [
		'.tar.bz2',
		'.tbz2'
	];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTarBz2;

	constructor(path: string) {
		super(path);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryTarBz2) => Promise<any>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(
		itter: (entry: EntryTarBz2) => Promise<any>
	) {
		await super._read(itter);
	}

	/**
	 * Get decompression transform streams.
	 *
	 * @returns List of decompression transforms.
	 */
	protected _decompressionTransforms() {
		const stream = unbzip2Stream() as Transform;
		return [stream];
	}
}
