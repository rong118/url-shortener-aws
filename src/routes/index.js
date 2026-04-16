const path = require('path');
const { Router } = require('express');
const { shorten, stats } = require('../controllers/urlController');
const { redirect } = require('../controllers/redirectController');
const createRateLimiter = require('../middleware/rateLimiter');

const shortenLimiter  = createRateLimiter({ max: 10, windowSeconds: 60, keyPrefix: 'shorten' });
const statsLimiter    = createRateLimiter({ max: 30, windowSeconds: 60, keyPrefix: 'stats' });
const redirectLimiter = createRateLimiter({ max: 60, windowSeconds: 60, keyPrefix: 'redirect' });

const router = Router();

router.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html')));
router.post('/api/shorten', shortenLimiter, shorten);
router.get('/api/stats/:code', statsLimiter, stats);
router.get('/:code', redirectLimiter, redirect);

module.exports = router;
