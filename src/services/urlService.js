const db = require('../config/db');
const redis = require('../config/redis');
const { generateCode } = require('../utils/base62');

const TTL_DAYS = parseInt(process.env.URL_TTL_DAYS) || 7;
const REDIS_TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;
const MAX_RETRIES = 5;

async function createShortUrl(originalUrl) {
  let shortCode;
  let attempts = 0;

  // Retry on the rare collision
  while (attempts < MAX_RETRIES) {
    shortCode = generateCode();
    try {
      const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
      const { rows } = await db.query(
        `INSERT INTO urls (original_url, short_code, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, short_code, created_at, expires_at`,
        [originalUrl, shortCode, expiresAt]
      );
      const url = rows[0];

      await redis.set(
        `url:${shortCode}`,
        JSON.stringify({ originalUrl, urlId: url.id }),
        { EX: REDIS_TTL_SECONDS }
      );

      return url;
    } catch (err) {
      if (err.code === '23505') {
        // unique_violation — try again
        attempts++;
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate a unique short code');
}

async function resolveShortCode(shortCode) {
  // Cache hit
  const cached = await redis.get(`url:${shortCode}`);
  if (cached) {
    const { originalUrl, urlId } = JSON.parse(cached);
    return { originalUrl, urlId, fromCache: true };
  }

  // Cache miss — query DB
  const { rows } = await db.query(
    `SELECT id, original_url, expires_at FROM urls
     WHERE short_code = $1 AND expires_at > NOW()`,
    [shortCode]
  );

  if (rows.length === 0) return null;

  const { id, original_url, expires_at } = rows[0];
  const remainingTtl = Math.floor((new Date(expires_at) - Date.now()) / 1000);

  // Re-populate cache
  if (remainingTtl > 0) {
    await redis.set(
      `url:${shortCode}`,
      JSON.stringify({ originalUrl: original_url, urlId: id }),
      { EX: remainingTtl }
    );
  }

  return { originalUrl: original_url, urlId: id, fromCache: false };
}

async function trackClick(urlId, { ip, userAgent, referrer }) {
  // Fire-and-forget: do both writes in parallel, don't block the redirect
  await Promise.all([
    db.query(
      `INSERT INTO clicks (url_id, ip_address, user_agent, referrer)
       VALUES ($1, $2, $3, $4)`,
      [urlId, ip, userAgent, referrer]
    ),
    db.query(
      `UPDATE urls SET click_count = click_count + 1 WHERE id = $1`,
      [urlId]
    ),
  ]);
}

async function getStats(shortCode) {
  const { rows } = await db.query(
    `SELECT u.short_code, u.original_url, u.created_at, u.expires_at, u.click_count,
            COALESCE(
              json_agg(
                json_build_object(
                  'clicked_at', c.clicked_at,
                  'ip_address', c.ip_address,
                  'user_agent', c.user_agent,
                  'referrer',   c.referrer
                ) ORDER BY c.clicked_at DESC
              ) FILTER (WHERE c.id IS NOT NULL),
              '[]'
            ) AS recent_clicks
     FROM urls u
     LEFT JOIN clicks c ON c.url_id = u.id
     WHERE u.short_code = $1
     GROUP BY u.id`,
    [shortCode]
  );

  return rows[0] || null;
}

module.exports = { createShortUrl, resolveShortCode, trackClick, getStats };
