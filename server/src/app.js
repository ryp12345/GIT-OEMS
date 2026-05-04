require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const authRoutes = require('./routes/auth.routes');
const courseRoutes = require('./routes/course.routes');
const instanceRoutes = require('./routes/instance.routes');
const studentRoutes = require('./routes/student.routes');
const preferencesRoutes = require('./routes/preferences.routes');
const allocationRoutes = require('./routes/allocation.routes');
const errorMiddleware = require('./middlewares/error.middleware');

app.use(express.json());
const isProduction = process.env.NODE_ENV === 'production';
const corsEnv = process.env.CORS_ORIGIN || process.env.CLIENT_URL || '';
const allowedOrigins = corsEnv
	.split(',')
	.map((origin) => normalizeOrigin(origin))
	.filter(Boolean);

function normalizeOrigin(origin) {
	return (origin || '').trim().replace(/\/+$/, '');
}

function getRequestOrigin(req) {
	const protocol = req.headers['x-forwarded-proto'] || req.protocol;
	const host = req.headers['x-forwarded-host'] || req.get('host');
	if (!protocol || !host) return '';
	return normalizeOrigin(`${protocol}://${host}`);
}

function isPrivateDevOrigin(origin) {
	try {
		const { hostname } = new URL(origin);
		if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
		if (hostname.startsWith('10.')) return true;
		if (hostname.startsWith('192.168.')) return true;
		const parts = hostname.split('.').map((part) => Number(part));
		if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		return false;
	} catch (e) {
		return false;
	}
}

app.use(cors(function(req, callback) {
	const requestOrigin = normalizeOrigin(req.header('Origin'));
	const sameSiteOrigin = getRequestOrigin(req);

	if (!requestOrigin) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	if (allowedOrigins.includes('*')) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	if (!isProduction && allowedOrigins.length === 0) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	if (!isProduction && isPrivateDevOrigin(requestOrigin)) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	// Check if origin matches allowed origins (with or without port)
	const isAllowed = allowedOrigins.some(allowed => {
		if (requestOrigin === allowed) return true;
		// Also check if the origin domain matches (ignoring port)
		try {
			const reqUrl = new URL(requestOrigin);
			const allowedUrl = new URL(allowed);
			if (reqUrl.protocol === allowedUrl.protocol && reqUrl.hostname === allowedUrl.hostname) {
				return true;
			}
		} catch (e) {
			// Ignore URL parsing errors
		}
		return false;
	});

	if (isAllowed || requestOrigin === sameSiteOrigin) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	callback(new Error('Not allowed by CORS: ' + requestOrigin));
}));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/allocations', allocationRoutes);

app.use(errorMiddleware);

module.exports = app;
