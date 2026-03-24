const userModel = require('../models/user.model');
const hash = require('../utils/hash');
const jwt = require('../utils/jwt');

exports.authenticate = async (username, password) => {
	const dept = await userModel.findByUsername(username);
	if (!dept) throw new Error('Invalid credentials');

	const stored = dept.password || '';
	const ok = await hash.compare(password, stored);
	if (!ok && stored !== password) throw new Error('Invalid credentials');

	// Use role from DB, fallback to 'hod'
	const role = dept.role || 'hod';
	const token = jwt.sign({ deptid: dept.deptid, username: dept.username, role });
	return {
		user: {
			deptid: dept.deptid,
			username: dept.username,
			name: dept.name,
			shortname: dept.shortname,
			role
		},
		token
	};
};

exports.changePassword = async ({ deptid, currentPassword, newPassword }) => {
	const dept = await userModel.findById(deptid);
	if (!dept) throw new Error('User not found');

	const stored = dept.password || '';
	const ok = await hash.compare(currentPassword, stored);
	if (!ok && stored !== currentPassword) {
		throw new Error('Current password is incorrect');
	}

	const nextHash = await hash.hash(newPassword);
	await userModel.updatePasswordById(deptid, nextHash);

	return { message: 'Password changed successfully' };
};
