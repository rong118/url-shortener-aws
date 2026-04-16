jest.mock('../../../src/config/redis');

const redis = require('../../../src/config/redis');
const createRateLimiter = require('../../../src/middleware/rateLimiter');

describe('createRateLimiter', () => {
  let req, res, next;

  beforeEach(() => {
    req = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
    res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('calls next() and sets rate limit headers when under the limit', async () => {
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
  });

  it('sets TTL only on the first request (count === 1)', async () => {
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(redis.expire).toHaveBeenCalledWith('rl:test:127.0.0.1', 60);
  });

  it('does not call expire on subsequent requests', async () => {
    redis.incr.mockResolvedValue(5);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('returns 429 and sets Retry-After when limit is exceeded', async () => {
    redis.incr.mockResolvedValue(11);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('Retry-After', 60);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests' });
  });

  it('clamps X-RateLimit-Remaining to 0 when count exceeds max', async () => {
    redis.incr.mockResolvedValue(15);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('fails open (calls next) when Redis throws', async () => {
    redis.incr.mockRejectedValue(new Error('Redis down'));

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses req.socket.remoteAddress as fallback when req.ip is absent', async () => {
    req.ip = undefined;
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);

    const limiter = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'test' });
    await limiter(req, res, next);

    expect(redis.incr).toHaveBeenCalledWith('rl:test:127.0.0.1');
  });
});
