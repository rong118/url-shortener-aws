jest.mock('../../../src/config/db');
jest.mock('../../../src/config/redis');
jest.mock('../../../src/utils/base62');

const db = require('../../../src/config/db');
const redis = require('../../../src/config/redis');
const { generateCode } = require('../../../src/utils/base62');
const { createShortUrl, resolveShortCode, trackClick, getStats } = require('../../../src/services/urlService');

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// createShortUrl
// ---------------------------------------------------------------------------
describe('createShortUrl', () => {
  it('inserts a row and caches it, then returns the row', async () => {
    generateCode.mockReturnValue('abc1234');
    const fakeRow = { id: 1, short_code: 'abc1234', created_at: new Date(), expires_at: new Date() };
    db.query.mockResolvedValueOnce({ rows: [fakeRow] });
    redis.set.mockResolvedValue('OK');

    const result = await createShortUrl('https://example.com');

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1][0]).toBe('https://example.com');
    expect(db.query.mock.calls[0][1][1]).toBe('abc1234');
    expect(redis.set).toHaveBeenCalledWith(
      'url:abc1234',
      expect.stringContaining('"originalUrl":"https://example.com"'),
      expect.objectContaining({ EX: expect.any(Number) })
    );
    expect(result).toBe(fakeRow);
  });

  it('retries on a unique_violation (pg error code 23505) and succeeds on the next attempt', async () => {
    generateCode
      .mockReturnValueOnce('collide')
      .mockReturnValueOnce('newcode');

    const collisionErr = Object.assign(new Error('duplicate'), { code: '23505' });
    const fakeRow = { id: 2, short_code: 'newcode', created_at: new Date(), expires_at: new Date() };
    db.query
      .mockRejectedValueOnce(collisionErr)
      .mockResolvedValueOnce({ rows: [fakeRow] });
    redis.set.mockResolvedValue('OK');

    const result = await createShortUrl('https://example.com');

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(result).toBe(fakeRow);
  });

  it('throws after MAX_RETRIES consecutive collisions', async () => {
    generateCode.mockReturnValue('collide');
    const collisionErr = Object.assign(new Error('duplicate'), { code: '23505' });
    db.query.mockRejectedValue(collisionErr);

    await expect(createShortUrl('https://example.com')).rejects.toThrow(
      'Failed to generate a unique short code'
    );
  });

  it('rethrows non-collision db errors immediately', async () => {
    generateCode.mockReturnValue('abc1234');
    const dbErr = new Error('connection failed');
    db.query.mockRejectedValue(dbErr);

    await expect(createShortUrl('https://example.com')).rejects.toThrow('connection failed');
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// resolveShortCode
// ---------------------------------------------------------------------------
describe('resolveShortCode', () => {
  it('returns cached data without hitting the DB', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ originalUrl: 'https://example.com', urlId: 1 }));

    const result = await resolveShortCode('abc1234');

    expect(result).toEqual({ originalUrl: 'https://example.com', urlId: 1, fromCache: true });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('falls back to the DB on a cache miss and re-populates cache', async () => {
    redis.get.mockResolvedValue(null);
    const expiresAt = new Date(Date.now() + 60_000);
    db.query.mockResolvedValue({
      rows: [{ id: 7, original_url: 'https://example.com', expires_at: expiresAt }],
    });
    redis.set.mockResolvedValue('OK');

    const result = await resolveShortCode('abc1234');

    expect(result).toMatchObject({ originalUrl: 'https://example.com', urlId: 7, fromCache: false });
    expect(redis.set).toHaveBeenCalled();
  });

  it('returns null when the code is not in DB', async () => {
    redis.get.mockResolvedValue(null);
    db.query.mockResolvedValue({ rows: [] });

    const result = await resolveShortCode('missing');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// trackClick
// ---------------------------------------------------------------------------
describe('trackClick', () => {
  it('inserts a click row and increments click_count in parallel', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await trackClick(1, { ip: '1.2.3.4', userAgent: 'UA', referrer: null });

    expect(db.query).toHaveBeenCalledTimes(2);
    const sqls = db.query.mock.calls.map((c) => c[0]);
    expect(sqls.some((s) => s.includes('INSERT INTO clicks'))).toBe(true);
    expect(sqls.some((s) => s.includes('UPDATE urls'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------
describe('getStats', () => {
  it('returns stats when the code exists', async () => {
    const fakeRow = { short_code: 'abc1234', original_url: 'https://example.com', click_count: 3, recent_clicks: [] };
    db.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await getStats('abc1234');

    expect(result).toBe(fakeRow);
  });

  it('returns null when the code does not exist', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const result = await getStats('missing');

    expect(result).toBeNull();
  });
});
