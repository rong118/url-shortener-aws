jest.mock('../../src/config/redis');
jest.mock('../../src/config/db');
jest.mock('../../src/services/urlService');

const request = require('supertest');
const app = require('../../src/app');
const redis = require('../../src/config/redis');
const urlService = require('../../src/services/urlService');

const FAKE_ROW = {
  short_code: 'abc1234',
  expires_at: '2026-04-24T00:00:00Z',
  created_at: '2026-04-17T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: rate limiter stays under limit
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

describe('POST /api/shorten', () => {
  it('returns 201 with short URL data for a valid URL', async () => {
    urlService.createShortUrl.mockResolvedValue(FAKE_ROW);

    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      short_code: 'abc1234',
      original_url: 'https://example.com',
      expires_at: FAKE_ROW.expires_at,
      created_at: FAKE_ROW.created_at,
    });
    expect(res.body.short_url).toMatch(/\/abc1234$/);
    expect(urlService.createShortUrl).toHaveBeenCalledWith('https://example.com');
  });

  it('returns 400 when url field is missing', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url is required' });
    expect(urlService.createShortUrl).not.toHaveBeenCalled();
  });

  it('returns 400 when url is not a string', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 123 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url is required' });
  });

  it('returns 400 when url is not a valid URL', async () => {
    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid URL' });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    redis.incr.mockResolvedValue(11); // max is 10

    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests' });
    expect(urlService.createShortUrl).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    urlService.createShortUrl.mockRejectedValue(new Error('db exploded'));

    const res = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(500);
    console.error.mockRestore();
  });
});
