const preferencesModel = require('../models/preferences.model');

async function submitPreferences(payload = {}) {
	const preferences = Array.isArray(payload.preferences) ? payload.preferences : [];

	if (preferences.length === 0) {
		const error = new Error('No preferences provided');
		error.statusCode = 400;
		throw error;
	}

	for (const pref of preferences) {
		const instanceCourseId = Number(pref.instance_course_id);
		const preferred = Number(pref.preferred);
		if (!Number.isInteger(instanceCourseId) || instanceCourseId <= 0) {
			const error = new Error('Each preference must have a valid instance_course_id');
			error.statusCode = 400;
			throw error;
		}
		if (!pref.usn || typeof pref.usn !== 'string' || !pref.usn.trim()) {
			const error = new Error('Each preference must have a valid usn');
			error.statusCode = 400;
			throw error;
		}
		if (!Number.isInteger(preferred) || preferred <= 0) {
			const error = new Error('Each preference must have a positive integer preferred order');
			error.statusCode = 400;
			throw error;
		}
	}

	await preferencesModel.insertPreferences(preferences);
	return { message: 'Preferences saved successfully', count: preferences.length };
}

module.exports = { submitPreferences };
