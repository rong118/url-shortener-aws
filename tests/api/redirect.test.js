jest.mock('../../src/config/redis');
jest.mock('../../src/config/db');
jest.mock('../../src/services/urlService');

const request = require('supertest');
const app = require('../../src/app');
const redis = require('../../src/config/redis');
const urlService = require('../../src/services/urlService');

beforeEach(() => {
  jest.clearAllMocks();
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

describe('GET /:code', () => {
  it('redirects (302) to the original URL for a valid code', async () => {
    urlService.resolveShortCode.mockResolvedValue({
      originalUrl: 'https://example.com',
      urlId: 1,
      fromCache: true,
    });
    urlService.trackClick.mockResolvedValue();

    const res = await request(app).get('/abc1234').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
    expect(urlService.resolveShortCode).toHaveBeenCalledWith('abc1234');
  });

  it('returns 404 for an unknown code', async () => {
    urlService.resolveShortCode.mockResolvedValue(null);

    const res = await request(app).get('/unknown').redirects(0);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Short URL not found or expired' });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    redis.incr.mockResolvedValue(61); // max is 60

    const res = await request(app).get('/abc1234').redirects(0);

    expect(res.status).toBe(429);
    expect(urlService.resolveShortCode).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    urlService.resolveShortCode.mockRejectedValue(new Error('cache failure'));

    const res = await request(app).get('/abc1234').redirects(0);

    expect(res.status).toBe(500);
    console.error.mockRestore();
  });
});
