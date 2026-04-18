jest.mock('../../src/config/redis');
jest.mock('../../src/config/db');
jest.mock('../../src/services/urlService');

const request = require('supertest');
const app = require('../../src/app');
const redis = require('../../src/config/redis');
const urlService = require('../../src/services/urlService');

const FAKE_STATS = {
  short_code: 'abc1234',
  original_url: 'https://example.com',
  created_at: '2026-04-17T00:00:00Z',
  expires_at: '2026-04-24T00:00:00Z',
  click_count: 5,
  recent_clicks: [
    { clicked_at: '2026-04-17T10:00:00Z', ip_address: '1.2.3.4', referrer: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

describe('GET /api/stats/:code', () => {
  it('returns 200 with full stats for a valid code', async () => {
    urlService.getStats.mockResolvedValue(FAKE_STATS);

    const res = await request(app).get('/api/stats/abc1234');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      short_code: 'abc1234',
      original_url: 'https://example.com',
      click_count: 5,
      recent_clicks: expect.any(Array),
    });
    expect(res.body.short_url).toMatch(/\/abc1234$/);
    expect(urlService.getStats).toHaveBeenCalledWith('abc1234');
  });

  it('returns 404 for an unknown code', async () => {
    urlService.getStats.mockResolvedValue(null);

    const res = await request(app).get('/api/stats/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Short URL not found' });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    redis.incr.mockResolvedValue(31); // max is 30

    const res = await request(app).get('/api/stats/abc1234');

    expect(res.status).toBe(429);
    expect(urlService.getStats).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    urlService.getStats.mockRejectedValue(new Error('db error'));

    const res = await request(app).get('/api/stats/abc1234');

    expect(res.status).toBe(500);
    console.error.mockRestore();
  });
});
