const { Pool } = require('pg');
require('dotenv').config();

const {
	DATABASE_URL,
	DB_HOST,
	DB_PORT,
	DB_NAME,
	DB_USER,
	DB_PASS
} = process.env;

const connectionString = DATABASE_URL || `postgres://${DB_USER || 'postgres'}:${encodeURIComponent(DB_PASS || '')}@${DB_HOST || 'localhost'}:${DB_PORT || 5432}/${DB_NAME || 'oems'}`;
const pool = new Pool({ connectionString });

module.exports = pool;
