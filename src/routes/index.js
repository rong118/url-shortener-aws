const { Router } = require('express');
const { shorten, stats } = require('../controllers/urlController');
const { redirect } = require('../controllers/redirectController');

const router = Router();

router.post('/api/shorten', shorten);
router.get('/api/stats/:code', stats);
router.get('/:code', redirect);

module.exports = router;
