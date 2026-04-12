const { resolveShortCode, trackClick } = require('../services/urlService');

async function redirect(req, res, next) {
  try {
    const { code } = req.params;
    const result = await resolveShortCode(code);

    if (!result) {
      return res.status(404).json({ error: 'Short URL not found or expired' });
    }

    // Redirect immediately, track asynchronously
    res.redirect(302, result.originalUrl);

    trackClick(result.urlId, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      referrer: req.get('referer') || null,
    }).catch((err) => console.error('trackClick error:', err));
  } catch (err) {
    next(err);
  }
}

module.exports = { redirect };
