require('dotenv').config();
const app = require('./app');
const db = require('./config/db');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3000;

async function start() {
  await redis.connect();
  await db.query('SELECT 1'); // verify DB connection
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
