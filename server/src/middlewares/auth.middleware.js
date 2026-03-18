const jwt = require('../utils/jwt');

module.exports = (req, res, next) => {
	const authHeader = req.headers.authorization || '';
	const [scheme, token] = authHeader.split(' ');

	if (scheme !== 'Bearer' || !token) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	try {
		const payload = jwt.verify(token);
		req.user = payload;
		return next();
	} catch (err) {
		return res.status(401).json({ error: 'Invalid or expired token' });
	}
};
