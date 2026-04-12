const path = require('path');
const { Router } = require('express');
const { shorten, stats } = require('../controllers/urlController');
const { redirect } = require('../controllers/redirectController');

const router = Router();

router.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html')));
router.post('/api/shorten', shorten);
router.get('/api/stats/:code', stats);
router.get('/:code', redirect);

module.exports = router;
