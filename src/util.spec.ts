import {
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
});
