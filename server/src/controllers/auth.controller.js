const authService = require('../services/auth.service');

exports.login = async (req, res, next) => {
	try {
		const { username, password } = req.body;
		if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
		const result = await authService.authenticate(username, password);
		res.json(result);
	} catch (err) {
		res.status(401).json({ error: err.message || 'Authentication failed' });
	}
};

exports.changePassword = async (req, res) => {
	try {
		const { currentPassword, newPassword } = req.body;
		if (!currentPassword || !newPassword) {
			return res.status(400).json({ error: 'Current password and new password are required' });
		}

		if (String(newPassword).length < 6) {
			return res.status(400).json({ error: 'New password must be at least 6 characters' });
		}

		if (currentPassword === newPassword) {
			return res.status(400).json({ error: 'New password must be different from current password' });
		}

		const result = await authService.changePassword({
			deptid: req.user.deptid,
			currentPassword,
			newPassword
		});

		return res.json(result);
	} catch (err) {
		return res.status(400).json({ error: err.message || 'Unable to change password' });
	}
};
