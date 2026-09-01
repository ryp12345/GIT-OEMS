const preferencesModel = require('../models/preferences.model');
const studentModel = require('../models/student.model');
const emailService = require('./email.service');
const pool = require('../config/db');

function normalizeCode(value) {
	return String(value || '')
		.toUpperCase()
		.replace(/[\[\]{}()'"`]/g, '')
		.replace(/\s+/g, '')
		.trim();
}

function parseCodes(value) {
	return String(value || '')
		.split(/[;,/|]+/)
		.map((code) => normalizeCode(code))
		.filter(Boolean);
}

async function validateLearntOnlyCompulsoryPreferences(preferences) {
	const usn = String(preferences[0].usn || '').trim().toUpperCase();
	const submittedIds = preferences.map((pref) => Number(pref.instance_course_id));
	const uniqueSubmittedIds = new Set(submittedIds);

	const submittedInstanceCoursesRes = await pool.query(
		`SELECT id, instance_id
		 FROM public.instance_courses
		 WHERE id = ANY($1::int[])`,
		[submittedIds]
	);

	if (submittedInstanceCoursesRes.rowCount !== uniqueSubmittedIds.size) {
		const error = new Error('One or more selected courses are invalid');
		error.statusCode = 400;
		throw error;
	}

	const instanceIds = new Set(submittedInstanceCoursesRes.rows.map((row) => Number(row.instance_id)));
	if (instanceIds.size !== 1) {
		const error = new Error('All preferences must belong to a single active instance');
		error.statusCode = 400;
		throw error;
	}

	const instanceId = Number(submittedInstanceCoursesRes.rows[0].instance_id);

	const learntOnlyCoursesRes = await pool.query(
		`SELECT ic.id AS icid, c.pre_req
		 FROM public.instance_courses ic
		 JOIN public.courses c ON UPPER(TRIM(c.coursecode)) = UPPER(TRIM(ic.coursecode))
		 WHERE ic.instance_id = $1
		   AND LOWER(TRIM(COALESCE(c.compulsory_prereq, ''))) = 'learntonly'`,
		[instanceId]
	);

	if (learntOnlyCoursesRes.rowCount === 0) {
		return;
	}

	const allocatedRes = await pool.query(
		`SELECT DISTINCT
			UPPER(TRIM(ic.coursecode)) AS coursecode,
			CAST(c.id AS TEXT) AS courseid
		 FROM public.preferences p
		 JOIN public.instance_courses ic ON ic.id = p.instance_course_id
		 JOIN public.courses c ON UPPER(TRIM(c.coursecode)) = UPPER(TRIM(ic.coursecode))
		 WHERE UPPER(p.usn) = UPPER($1)
		   AND (
			 UPPER(COALESCE(p.allocation_status, '')) = 'ALLOTTED'
			 OR p.status = p.final_preference
		   )`,
		[usn]
	);

	const allocatedCodes = new Set(
		allocatedRes.rows
			.map((row) => normalizeCode(row.coursecode))
			.filter(Boolean)
	);
	const allocatedCourseIds = new Set(
		allocatedRes.rows
			.map((row) => String(row.courseid || '').trim())
			.filter(Boolean)
	);

	const isAllocated = (code) => allocatedCodes.has(code) || allocatedCourseIds.has(code);
	const forcedIds = learntOnlyCoursesRes.rows
		.filter((row) => {
			const prereqCodes = parseCodes(row.pre_req);
			return prereqCodes.length > 0 && prereqCodes.every((code) => isAllocated(code));
		})
		.map((row) => Number(row.icid));

	if (forcedIds.length === 0) {
		return;
	}

	const forcedIdSet = new Set(forcedIds);
	const hasOnlyForcedCourses = (
		uniqueSubmittedIds.size === forcedIdSet.size
		&& [...uniqueSubmittedIds].every((id) => forcedIdSet.has(id))
	);

	if (!hasOnlyForcedCourses) {
		const error = new Error('Based on learnt compulsory prerequisite, only specific compulsory course(s) can be selected');
		error.statusCode = 400;
		throw error;
	}
}

async function validatePreferencesInstanceIsActive(preferences) {
	const submittedIds = preferences.map((pref) => Number(pref.instance_course_id));

	const result = await pool.query(
		`SELECT i.id, i.status
		 FROM public.instances i
		 JOIN public.instance_courses ic ON ic.instance_id = i.id
		 WHERE ic.id = ANY($1::int[])
		 GROUP BY i.id, i.status`,
		[submittedIds]
	);

	if (result.rowCount !== 1) {
		const error = new Error('All preferences must belong to a single instance');
		error.statusCode = 400;
		throw error;
	}

	const status = String(result.rows[0].status || '').trim().toLowerCase();
	if (status !== 'active') {
		const error = new Error('Elective registration is currently closed for this instance');
		error.statusCode = 403;
		throw error;
	}
}

async function submitPreferences(payload = {}) {
	const preferences = Array.isArray(payload.preferences) ? payload.preferences : [];
	const email = String(payload.email || '').trim().toLowerCase();
	const usn = preferences.length > 0 ? String(preferences[0].usn || '').trim().toUpperCase() : '';

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

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		const error = new Error('A valid email is required before saving preferences');
		error.statusCode = 400;
		throw error;
	}

	await validatePreferencesInstanceIsActive(preferences);
	await validateLearntOnlyCompulsoryPreferences(preferences);
	const studentRow = await pool.query(
		`SELECT name, usn, email
		 FROM public.students
		 WHERE UPPER(usn) = UPPER($1)
		 LIMIT 1`,
		[usn]
	);
	const studentName = studentRow.rows[0]?.name || '';
	await studentModel.updateStudentEmailByUsn(usn, email);

	await preferencesModel.insertPreferences(preferences);
	const preferenceDetails = await preferencesModel.getPreferenceSubmissionDetails(preferences);
	await emailService.sendPreferenceConfirmationEmail({
		to: email,
		usn,
		studentName,
		preferences: preferenceDetails
	});
	return { message: 'Preferences saved successfully', count: preferences.length };
}

module.exports = { submitPreferences };
