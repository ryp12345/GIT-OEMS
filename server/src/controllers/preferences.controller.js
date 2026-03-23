const preferencesService = require('../services/preferences.service');

exports.submit = async (req, res, next) => {
	try {
		const data = await preferencesService.submitPreferences(req.body);
		res.status(201).json(data);
	} catch (error) {
		next(error);
	}
};
