const instanceModel = require('../models/instance.model');

const VALID_STATUSES = new Set(['Active', 'Inactive']);

function normalizePayload(payload = {}) {
	const instancename = String(payload.instancename || '').trim();
	const semesterValue = Number(payload.semester);
	const academic_year = String(payload.academic_year || '').trim();
	const status = String(payload.status || 'Active').trim();

	if (!instancename) {
		const error = new Error('Instance name is required');
		error.statusCode = 400;
		throw error;
	}

	if (!Number.isInteger(semesterValue) || semesterValue <= 0) {
		const error = new Error('Semester must be a positive integer');
		error.statusCode = 400;
		throw error;
	}

	if (!academic_year || academic_year.length > 12) {
		const error = new Error('Academic year is required and must be at most 12 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!VALID_STATUSES.has(status)) {
		const error = new Error('Status must be either Active or Inactive');
		error.statusCode = 400;
		throw error;
	}

	return {
		instancename,
		semester: semesterValue,
		academic_year,
		status
	};
}

async function getInstances() {
	return instanceModel.listInstances();
}

async function getInstanceView(instanceId) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	const [courses, departments] = await Promise.all([
		instanceModel.listInstanceCourses(numericId),
		instanceModel.listDepartments()
	]);

	return {
		instance,
		courses,
		departments
	};
}

function normalizeCourseMapping(mapping = {}) {
	const coursecode = String(mapping.coursecode || '').trim().toUpperCase();
	const division = Number(mapping.division);
	const min_intake = Number(mapping.min_intake);
	const max_intake = Number(mapping.max_intake);
	const department_ids = Array.isArray(mapping.department_ids)
		? mapping.department_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
		: [];

	if (!coursecode) {
		const error = new Error('Course code is required for instance mapping');
		error.statusCode = 400;
		throw error;
	}

	if (!Number.isInteger(division) || division < 0) {
		const error = new Error(`Division must be a non-negative integer for ${coursecode}`);
		error.statusCode = 400;
		throw error;
	}

	if (!Number.isInteger(min_intake) || min_intake < 0) {
		const error = new Error(`Minimum intake must be a non-negative integer for ${coursecode}`);
		error.statusCode = 400;
		throw error;
	}

	if (!Number.isInteger(max_intake) || max_intake < 0) {
		const error = new Error(`Maximum intake must be a non-negative integer for ${coursecode}`);
		error.statusCode = 400;
		throw error;
	}

	if (max_intake < min_intake) {
		const error = new Error(`Maximum intake must be greater than or equal to minimum intake for ${coursecode}`);
		error.statusCode = 400;
		throw error;
	}

	return {
		coursecode,
		division,
		min_intake,
		max_intake,
		department_ids
	};
}

async function updateInstanceCourseMappings(instanceId, payload = {}) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	const mappings = Array.isArray(payload.courses) ? payload.courses.map(normalizeCourseMapping) : [];
	if (mappings.length === 0) {
		const error = new Error('At least one course mapping is required');
		error.statusCode = 400;
		throw error;
	}

	await instanceModel.saveInstanceCourseMappings(numericId, mappings);
	return getInstanceView(numericId);
}

async function addInstance(payload) {
	return instanceModel.createInstance(normalizePayload(payload));
}

async function editInstance(id, payload) {
	const numericId = Number(id);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const updated = await instanceModel.updateInstance(numericId, normalizePayload(payload));
	if (!updated) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	return updated;
}

async function removeInstance(id) {
	const numericId = Number(id);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const deleted = await instanceModel.deleteInstance(numericId);
	if (!deleted) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	return true;
}

async function getPreferenceStatistics(instanceId) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	return instanceModel.getPreferenceStatisticsByInstance(numericId);
}

async function getPreferenceStatisticsDetails(instanceId, options = {}) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	return instanceModel.getPreferenceStatisticsDetailsByInstance(numericId, options);
}

async function resetAllocations(instanceId) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	await instanceModel.resetAllocationsByInstance(numericId);
	return { message: 'Allocations reset successfully' };
}

async function runAllocation(instanceId) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}

	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}

	// Delegate actual allocation logic to the model
	return instanceModel.runAllocationByInstance(numericId);
}

function ensureValidInstanceId(instanceId) {
	const numericId = Number(instanceId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid instance id');
		error.statusCode = 400;
		throw error;
	}
	return numericId;
}

async function ensureInstanceExists(numericId) {
	const instance = await instanceModel.getInstanceById(numericId);
	if (!instance) {
		const error = new Error('Instance not found');
		error.statusCode = 404;
		throw error;
	}
}

async function setFinalPreferences(instanceId) {
	const numericId = ensureValidInstanceId(instanceId);
	await ensureInstanceExists(numericId);
	return instanceModel.setFinalPreferencesByInstance(numericId);
}

async function rejectUnderSubscribedCourses(instanceId) {
	const numericId = ensureValidInstanceId(instanceId);
	await ensureInstanceExists(numericId);
	return instanceModel.rejectUnderSubscribedCoursesByInstance(numericId);
}

async function upgradePreferences(instanceId, payload = {}) {
	const numericId = ensureValidInstanceId(instanceId);
	await ensureInstanceExists(numericId);

	const rejectedCourseIds = Array.isArray(payload.rejectedCourseIds)
		? payload.rejectedCourseIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
		: [];

	return instanceModel.upgradePreferencesByInstance(numericId, rejectedCourseIds);
}

async function allocate(instanceId) {
	const numericId = ensureValidInstanceId(instanceId);
	await ensureInstanceExists(numericId);
	return instanceModel.allocateByInstance(numericId);
}

module.exports = {
	getInstances,
	getInstanceView,
	updateInstanceCourseMappings,
	addInstance,
	editInstance,
	removeInstance,
	getPreferenceStatistics,
	getPreferenceStatisticsDetails,
	resetAllocations
,
	runAllocation,
	setFinalPreferences,
	rejectUnderSubscribedCourses,
	upgradePreferences,
	allocate
};