const instanceService = require('../services/instance.service');

exports.list = async (req, res, next) => {
	try {
		const instances = await instanceService.getInstances();
		res.json(instances);
	} catch (error) {
		next(error);
	}
};

exports.view = async (req, res, next) => {
	try {
		const data = await instanceService.getInstanceView(req.params.id);
		res.json(data);
	} catch (error) {
		next(error);
	}
};

exports.updateMappings = async (req, res, next) => {
	try {
		const data = await instanceService.updateInstanceCourseMappings(req.params.id, req.body);
		res.json(data);
	} catch (error) {
		next(error);
	}
};

exports.create = async (req, res, next) => {
	try {
		const created = await instanceService.addInstance(req.body);
		res.status(201).json(created);
	} catch (error) {
		next(error);
	}
};

exports.update = async (req, res, next) => {
	try {
		const updated = await instanceService.editInstance(req.params.id, req.body);
		res.json(updated);
	} catch (error) {
		next(error);
	}
};

exports.remove = async (req, res, next) => {
	try {
		await instanceService.removeInstance(req.params.id);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
};

exports.getPreferenceStatistics = async (req, res, next) => {
	try {
		const data = await instanceService.getPreferenceStatistics(req.params.id);
		res.json(data);
	} catch (error) {
		next(error);
	}
};

exports.getPreferenceStatisticsDetails = async (req, res, next) => {
	try {
		const strictSarJoinRaw = String(req.query.strictSarJoin || '').toLowerCase();
		const strictSarJoin = strictSarJoinRaw
			? !['0', 'false', 'no', 'off'].includes(strictSarJoinRaw)
			: true;
		const data = await instanceService.getPreferenceStatisticsDetails(req.params.id, { strictSarJoin });
		res.json(data);
	} catch (error) {
		next(error);
	}
};

exports.runAllocation = async (req, res, next) => {
    try {
        const data = await instanceService.runAllocation(req.params.id);
        res.json({ message: 'Allocation run completed', result: data });
    } catch (error) {
        next(error);
    }
};

exports.resetAllocations = async (req, res, next) => {
	try {
		const data = await instanceService.resetAllocations(req.params.id);
		res.json(data);
	} catch (error) {
		next(error);
	}
};

exports.setFinalPreferences = async (req, res, next) => {
	try {
		const data = await instanceService.setFinalPreferences(req.params.id);
		res.json({ message: 'Final preferences set', result: data });
	} catch (error) {
		next(error);
	}
};

exports.rejectUnderSubscribedCourses = async (req, res, next) => {
	try {
		const data = await instanceService.rejectUnderSubscribedCourses(req.params.id);
		res.json({ message: 'Under-subscribed courses rejected', ...data });
	} catch (error) {
		next(error);
	}
};

exports.upgradePreferences = async (req, res, next) => {
	try {
		const data = await instanceService.upgradePreferences(req.params.id, req.body);
		res.json({ message: 'Preferences upgraded', result: data });
	} catch (error) {
		next(error);
	}
};

exports.allocate = async (req, res, next) => {
	try {
		const data = await instanceService.allocate(req.params.id);
		res.json({ message: 'Allocation completed', result: data });
	} catch (error) {
		next(error);
	}
};