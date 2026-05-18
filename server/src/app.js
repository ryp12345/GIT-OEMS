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

app.set('trust proxy', 1);
app.use(express.json());
const isProduction = process.env.NODE_ENV === 'production';
const corsEnv = [
	process.env.CORS_ORIGIN,
	process.env.CLIENT_URL,
	process.env.FRONTEND_URL
]
	.filter(Boolean)
	.join(',');

function isTemplatePlaceholder(value) {
	return /^\$\{[^}]+\}$/.test((value || '').trim());
}

const allowedOrigins = corsEnv
	.split(',')
	.map((origin) => normalizeOrigin(origin))
	.filter((origin) => !isTemplatePlaceholder(origin))
	.filter(Boolean);

function normalizeOrigin(origin) {
	return (origin || '').trim().replace(/\/+$/, '');
}

function parseOrigin(value) {
	const normalized = normalizeOrigin(value);
	if (!normalized) return null;

	try {
		const parsed = new URL(normalized);
		return {
			raw: normalized,
			protocol: parsed.protocol,
			hostname: parsed.hostname,
			port: parsed.port,
			isWildcard: false
		};
	} catch (_error) {
		const wildcardMatch = normalized.match(/^\*\.([a-z0-9.-]+)$/i);
		if (wildcardMatch) {
			return {
				raw: normalized,
				protocol: null,
				hostname: wildcardMatch[1].toLowerCase(),
				port: '',
				isWildcard: true
			};
		}

		const hostPortMatch = normalized.match(/^([a-z0-9.-]+)(?::(\d+))?$/i);
		if (!hostPortMatch) return null;

		return {
			raw: normalized,
			protocol: null,
			hostname: hostPortMatch[1].toLowerCase(),
			port: hostPortMatch[2] || '',
			isWildcard: false
		};
	}
}

function originMatches(requestOrigin, allowedOrigin) {
	if (requestOrigin === allowedOrigin.raw) return true;

	const parsedRequest = parseOrigin(requestOrigin);
	if (!parsedRequest) return false;

	if (allowedOrigin.isWildcard) {
		return parsedRequest.hostname === allowedOrigin.hostname || parsedRequest.hostname.endsWith(`.${allowedOrigin.hostname}`);
	}

	if (allowedOrigin.protocol && parsedRequest.protocol !== allowedOrigin.protocol) {
		return false;
	}

	if (parsedRequest.hostname !== allowedOrigin.hostname) {
		return false;
	}

	if (allowedOrigin.port && parsedRequest.port !== allowedOrigin.port) {
		return false;
	}

	return true;
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

	const parsedAllowedOrigins = allowedOrigins
		.map((origin) => parseOrigin(origin))
		.filter(Boolean);

	const isAllowed = parsedAllowedOrigins.some((allowedOrigin) => originMatches(requestOrigin, allowedOrigin));

	if (isAllowed || requestOrigin === sameSiteOrigin) {
		callback(null, { credentials: true, origin: true });
		return;
	}

	if (isProduction) {
		console.warn('[CORS] Blocked origin:', requestOrigin, '| Allowed:', allowedOrigins);
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
