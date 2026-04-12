const { generateCode } = require('../../../src/utils/base62');

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

describe('generateCode', () => {
  it('returns a string of length 7', () => {
    expect(generateCode()).toHaveLength(7);
  });

  it('only contains base62 characters', () => {
    const code = generateCode();
    for (const ch of code) {
      expect(BASE62_CHARS).toContain(ch);
    }
  });

  it('produces different values on successive calls', () => {
    const codes = new Set(Array.from({ length: 20 }, generateCode));
    // With 62^7 possibilities the chance of any collision in 20 draws is negligible
    expect(codes.size).toBeGreaterThan(1);
  });
});
