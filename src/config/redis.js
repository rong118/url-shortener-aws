const { createClient } = require('redis');

const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

client.on('error', (err) => console.error('Redis error:', err));

module.exports = client;
