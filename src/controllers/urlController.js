const { createShortUrl, getStats } = require('../services/urlService');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function shorten(req, res, next) {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const result = await createShortUrl(url);

    res.status(201).json({
      short_url: `${BASE_URL}/${result.short_code}`,
      short_code: result.short_code,
      original_url: url,
      expires_at: result.expires_at,
      created_at: result.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function stats(req, res, next) {
  try {
    const { code } = req.params;
    const result = await getStats(code);

    if (!result) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    res.json({
      short_code: result.short_code,
      short_url: `${BASE_URL}/${result.short_code}`,
      original_url: result.original_url,
      created_at: result.created_at,
      expires_at: result.expires_at,
      click_count: result.click_count,
      recent_clicks: result.recent_clicks,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { shorten, stats };
