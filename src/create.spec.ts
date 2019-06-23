import {
	createArchiveByFileExtension
} from './create';

describe('create', () => {
	describe('createArchiveByFileExtension', () => {
		it('file.zip', () => {
			expect(createArchiveByFileExtension('file.zip')).toBeTruthy();
		});

		it('file.unknown', () => {
			expect(createArchiveByFileExtension('file.unknown')).toBeNull();
		});
	});
});
