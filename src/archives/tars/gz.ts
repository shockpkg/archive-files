import {
	createGunzip
} from 'zlib';

import {
	ArchiveTar,
	EntryTar,
	IEntryInfoTar
} from '../tar';

export interface IEntryInfoTarGz extends IEntryInfoTar {
	/**
	 * Entry archive.
	 */
	archive: ArchiveTarGz;
}

/**
 * EntryTarGz constructor.
 *
 * @param info Info object.
 */
export class EntryTarGz extends EntryTar {
	/**
	 * Entry archive.
	 */
	public readonly archive: ArchiveTarGz;

	constructor(info: IEntryInfoTarGz) {
		super(info);

		this.archive = info.archive;
	}
}

/**
 * ArchiveTarGz constructor.
 *
 * @param path File path.
 */
export class ArchiveTarGz extends ArchiveTar {
	/**
	 * List of file extensions, or null.
	 * All subclasses should implement this property.
	 */
	public static FILE_EXTENSIONS: string[] | null = [
		'.tar.gz',
		'.tgz'
	];

	/**
	 * Entry constructor.
	 */
	public readonly Entry = EntryTarGz;

	constructor(path: string) {
		super(path);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	public async read(itter: (entry: EntryTarGz) => Promise<any>) {
		await super.read(itter);
	}

	/**
	 * Read archive, class implementation.
	 * If the itter callback returns false, reading ends.
	 *
	 * @param itter Async callback for each archive entry.
	 */
	protected async _read(
		itter: (entry: EntryTarGz) => Promise<any>
	) {
		await super._read(itter);
	}

	/**
	 * Get decompression transform streams.
	 *
	 * @return List of decompression transforms.
	 */
	protected _decompressionTransforms() {
		return [createGunzip()];
	}
}
