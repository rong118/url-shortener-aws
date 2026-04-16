const redis = require('../config/redis');

/**
 * Creates a fixed-window rate limiter middleware backed by Redis.
 *
 * @param {object} options
 * @param {number} options.max           - Max requests allowed per window
 * @param {number} options.windowSeconds - Window size in seconds
 * @param {string} options.keyPrefix     - Prefix to namespace Redis keys (e.g. 'shorten')
 */
function createRateLimiter({ max, windowSeconds, keyPrefix }) {
  return async function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress;
    const key = `rl:${keyPrefix}:${ip}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', Math.max(0, max - count));

      if (count > max) {
        res.set('Retry-After', windowSeconds);
        return res.status(429).json({ error: 'Too many requests' });
      }

      next();
    } catch {
      // Fail open: if Redis is unavailable, don't block requests
      next();
    }
  };
}

module.exports = createRateLimiter;
