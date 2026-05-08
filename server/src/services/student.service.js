const studentModel = require('../models/student.model');
const XLSX = require('xlsx');
const pool = require('../config/db');

const VALID_SEMESTERS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

function normalizeDepartmentId(value) {
	const numericValue = Number(value);
	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		const error = new Error('Department is required');
		error.statusCode = 400;
		throw error;
	}
	return numericValue;
}

function normalizeInstanceId(value) {
	const numericValue = Number(value);
	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		const error = new Error('instance_id is required');
		error.statusCode = 400;
		throw error;
	}
	return numericValue;
}

function normalizePayload(payload = {}) {
	const name = String(payload.name || '').trim();
	const email = String(payload.email || '').trim().toLowerCase();
	const uid = String(payload.uid || '').trim().toUpperCase();
	const usn = String(payload.usn || '').trim().toUpperCase();
	const department_id = normalizeDepartmentId(payload.department_id);
	const semester = Number(payload.semester);
	const cgpaValue = Number(payload.cgpa);

	if (!name) {
		const error = new Error('Student name is required');
		error.statusCode = 400;
		throw error;
	}

	if (name.length > 255) {
		const error = new Error('Student name must be at most 255 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		const error = new Error('A valid email is required');
		error.statusCode = 400;
		throw error;
	}

	if (!uid || uid.length > 12) {
		const error = new Error('UID is required and must be at most 12 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!usn || usn.length > 12) {
		const error = new Error('USN is required and must be at most 12 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!VALID_SEMESTERS.has(semester)) {
		const error = new Error('Semester must be between 1 and 8');
		error.statusCode = 400;
		throw error;
	}

	if (!Number.isFinite(cgpaValue) || cgpaValue < 0 || cgpaValue > 10) {
		const error = new Error('CGPA must be between 0 and 10');
		error.statusCode = 400;
		throw error;
	}

	return {
		name,
		email,
		uid,
		usn,
		department_id,
		semester,
		cgpa: Number(cgpaValue.toFixed(2))
	};
}

async function ensureDepartmentExists(departmentId) {
	const exists = await studentModel.departmentExists(departmentId);
	if (!exists) {
		const error = new Error('Selected department was not found');
		error.statusCode = 400;
		throw error;
	}
}

async function ensureInstanceExists(instanceId) {
	const result = await pool.query(
		'SELECT id FROM public.instances WHERE id = $1 LIMIT 1',
		[instanceId]
	);
	if (result.rowCount === 0) {
		const error = new Error('Selected instance was not found');
		error.statusCode = 400;
		throw error;
	}
}

async function ensureUniqueStudentFields(student, excludedId = null) {
	const duplicateEmail = await studentModel.findStudentByField('email', student.email, excludedId);
	if (duplicateEmail) {
		const error = new Error('Email already exists');
		error.statusCode = 409;
		throw error;
	}

	const duplicateUid = await studentModel.findStudentByField('uid', student.uid, excludedId);
	if (duplicateUid) {
		const error = new Error('UID already exists');
		error.statusCode = 409;
		throw error;
	}

	const duplicateUsn = await studentModel.findStudentByField('usn', student.usn, excludedId);
	if (duplicateUsn) {
		const error = new Error('USN already exists');
		error.statusCode = 409;
		throw error;
	}
}

async function getStudents(instanceId) {
	return studentModel.listStudents(instanceId || null);
}

async function getStudentMeta() {
	const departments = await studentModel.listDepartments();
	return { departments };
}

async function generateStudentTemplateBuffer() {
	const departments = await studentModel.listDepartments();
	const workbook = XLSX.utils.book_new();
	const worksheet = XLSX.utils.aoa_to_sheet([]);

	XLSX.utils.sheet_add_aoa(worksheet, [[
		'Name',
		'Email',
		'UID',
		'USN',
		'Department ID',
		'Semester',
		'CGPA'
	]], { origin: 'A1' });

	XLSX.utils.sheet_add_aoa(worksheet, [
		['Asha Kulkarni', 'asha.kulkarni@git.edu', '01FE23BCS101', '2GI23CS001', '1', '3', '8.42'],
		['Rohan Patil', 'rohan.patil@git.edu', '01FE23BEC045', '2GI23EC014', '2', '5', '7.96']
	], { origin: 'A2' });

	XLSX.utils.sheet_add_aoa(worksheet, [['Department ID', 'Department Name']], { origin: 'J1' });
	XLSX.utils.sheet_add_aoa(
		worksheet,
		departments.map((department) => [department.id, department.name]),
		{ origin: 'J2' }
	);

	worksheet['!cols'] = [
		{ wch: 28 },
		{ wch: 34 },
		{ wch: 18 },
		{ wch: 16 },
		{ wch: 16 },
		{ wch: 12 },
		{ wch: 12 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 18 },
		{ wch: 30 }
	];

	XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Template');
	return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function normalizeHeaderName(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[\s\/.-]+/g, '_')
		.replace(/[^a-z0-9_]/g, '');
}

function getRowValue(row, aliases) {
	for (const alias of aliases) {
		const value = row[alias];
		if (value !== undefined && value !== null && String(value).trim() !== '') {
			return String(value).trim();
		}
	}
	return '';
}

function createLookupMap(items, accessors) {
	const lookup = new Map();
	items.forEach((item) => {
		accessors.forEach((accessor) => {
			const value = accessor(item);
			const key = String(value || '').trim().toLowerCase();
			if (key) {
				lookup.set(key, item);
			}
		});
	});
	return lookup;
}

function valuesMatch(left, right) {
	return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

async function resolveStudentForImport(student, rowNumber) {
	const matches = await studentModel.findStudentsForImport(student);
	if (matches.length === 0) {
		await ensureUniqueStudentFields(student);
		return studentModel.createStudent(student);
	}

	const distinctIds = [...new Set(matches.map((item) => item.id))];
	if (distinctIds.length > 1) {
		const error = new Error(`Row ${rowNumber}: email, UID, or USN match multiple existing students`);
		error.statusCode = 409;
		throw error;
	}

	const usnMatch = matches.find((item) => valuesMatch(item.usn, student.usn));
	if (usnMatch) {
		return studentModel.getStudentById(usnMatch.id);
	}

	const uidMatch = matches.find((item) => valuesMatch(item.uid, student.uid));
	const emailMatch = matches.find((item) => valuesMatch(item.email, student.email));

	if (uidMatch && emailMatch && uidMatch.id === emailMatch.id) {
		return studentModel.getStudentById(uidMatch.id);
	}

	const error = new Error(`Row ${rowNumber}: existing student was found, but uploaded USN, UID, and email do not identify the same record`);
	error.statusCode = 409;
	throw error;

}

async function upsertAcademicRecord(student, semester, cgpa, instanceId) {
	const existingAcademicRecord = await studentModel.getAcademicRecordByUsnAndSemester(
		student.usn,
		semester,
		instanceId
	);
	if (existingAcademicRecord) {
		await studentModel.updateAcademicRecord(existingAcademicRecord.id, {
			usn: student.usn,
			semester,
			cgpa,
			instance_id: instanceId
		});
		return;
	}

	await studentModel.createAcademicRecord({
		usn: student.usn,
		semester,
		cgpa,
		instance_id: instanceId
	});
}

async function importStudentsFromFile(fileBuffer, instanceId) {
	const normalizedInstanceId = normalizeInstanceId(instanceId);
	await ensureInstanceExists(normalizedInstanceId);
	const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
	const firstSheetName = workbook.SheetNames[0];

	if (!firstSheetName) {
		const error = new Error('Uploaded file does not contain any sheets');
		error.statusCode = 400;
		throw error;
	}

	const worksheet = workbook.Sheets[firstSheetName];
	const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
	const rows = rawRows
		.map((row) => Object.entries(row).reduce((result, [key, value]) => {
			result[normalizeHeaderName(key)] = value;
			return result;
		}, {}));

	if (rows.length === 0) {
		const error = new Error('Uploaded file is empty');
		error.statusCode = 400;
		throw error;
	}

	const departments = await studentModel.listDepartments();
	const departmentLookup = createLookupMap(departments, [
		(item) => item.id,
		(item) => item.name,
		(item) => item.shortname
	]);

	const importedStudents = [];

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const rowNumber = index + 2;
		const name = getRowValue(row, ['name', 'student_name']);
		const email = getRowValue(row, ['email', 'student_email']);
		const uid = getRowValue(row, ['uid']);
		const usn = getRowValue(row, ['usn']);
		const departmentValue = getRowValue(row, ['department_id', 'deptid', 'department', 'department_name']);
		const semester = getRowValue(row, ['semester', 'current_sem', 'current_semester']);
		const cgpa = getRowValue(row, ['cgpa', 'grade']);

		const hasAnyStudentField = [
			name,
			email,
			uid,
			usn,
			semester,
			cgpa
		].some((value) => Boolean(String(value || '').trim()));

		if (!hasAnyStudentField) {
			continue;
		}

		if (!name || !email || !uid || !usn || !departmentValue || !semester || !cgpa) {
			const error = new Error(`Row ${rowNumber}: name, email, uid, usn, department, semester, and cgpa are required`);
			error.statusCode = 400;
			throw error;
		}

		const department = departmentLookup.get(departmentValue.toLowerCase());
		if (!department) {
			const error = new Error(`Row ${rowNumber}: department "${departmentValue}" was not found`);
			error.statusCode = 400;
			throw error;
		}

		const payload = normalizePayload({
			name,
			email,
			uid,
			usn,
			department_id: department.id,
			semester,
			cgpa
		});

		await ensureDepartmentExists(payload.department_id);
		const student = await resolveStudentForImport(payload, rowNumber);
		await upsertAcademicRecord(student, payload.semester, payload.cgpa, normalizedInstanceId);
		importedStudents.push(await studentModel.getStudentById(student.id));
	}

	if (importedStudents.length === 0) {
		const error = new Error('Uploaded file does not contain any student rows');
		error.statusCode = 400;
		throw error;
	}

	return {
		importedCount: importedStudents.length,
		students: importedStudents
	};
}

async function addStudent(payload) {
	const student = normalizePayload(payload);
	const instanceId = normalizeInstanceId(payload.instance_id);
	await ensureDepartmentExists(student.department_id);
	await ensureInstanceExists(instanceId);
	await ensureUniqueStudentFields(student);
	const createdStudent = await studentModel.createStudent(student);
	await studentModel.createAcademicRecord({
		...student,
		instance_id: instanceId
	});
	return studentModel.getStudentById(createdStudent.id);
}

async function editStudent(id, payload) {
	const existing = await studentModel.getStudentById(id);
	if (!existing) {
		const error = new Error('Student not found');
		error.statusCode = 404;
		throw error;
	}

	const student = normalizePayload(payload);
	await ensureDepartmentExists(student.department_id);
	await ensureUniqueStudentFields(student, id);

	if (existing.usn && existing.usn !== student.usn) {
		await studentModel.updateAcademicRecordUsn(existing.usn, student.usn);
	}

	const academicRecord = await studentModel.getLatestAcademicRecordByUsn(student.usn);
	if (academicRecord) {
		await studentModel.updateAcademicRecord(academicRecord.id, {
			...student,
			instance_id: academicRecord.instance_id
		});
	} else {
		const instanceId = normalizeInstanceId(payload.instance_id);
		await studentModel.createAcademicRecord({ ...student, instance_id: instanceId });
	}

	return studentModel.updateStudent(id, student);
}

async function removeStudent(id) {
	const existing = await studentModel.getStudentById(id);
	if (!existing) {
		const error = new Error('Student not found');
		error.statusCode = 404;
		throw error;
	}

	const removed = await studentModel.deleteStudent(id);
	if (!removed) {
		const error = new Error('Student not found');
		error.statusCode = 404;
		throw error;
	}

	await studentModel.deleteAcademicRecordsByUsn(existing.usn);
}

async function checkName(payload = {}) {
	const uid = String(payload.uid1 || payload.uid || '').trim().toUpperCase();
	const name = String(payload.name1 || payload.name || '').trim();
	const usn = String(payload.usn || '').trim().toUpperCase();
	const normalizedName = name.replace(/\s+/g, ' ').trim();

	if (!uid || !usn || !name) {
		const error = new Error('uid, usn and name are required');
		error.statusCode = 400;
		throw error;
	}

	// PHP uses uid + usn + partial name matching. Keep that behavior, but normalize whitespace.
	let studentRes = await pool.query(
		`SELECT id, name, uid, usn, department_id
		 FROM public.students
		 WHERE UPPER(uid) = $1
		   AND UPPER(usn) = $2
		   AND REGEXP_REPLACE(LOWER(TRIM(name)), '\\s+', ' ', 'g') LIKE '%' || LOWER($3) || '%'
		 LIMIT 1`,
		[uid, usn, normalizedName]
	);

	// Fallback: if uid+usn identify exactly one student, accept minor name-format differences.
	if (studentRes.rowCount === 0) {
		studentRes = await pool.query(
			`SELECT id, name, uid, usn, department_id
			 FROM public.students
			 WHERE UPPER(uid) = $1
			   AND UPPER(usn) = $2
			 LIMIT 1`,
			[uid, usn]
		);
	}

	if (studentRes.rowCount === 0) {
		const error = new Error('Student not found with the provided details');
		error.statusCode = 404;
		throw error;
	}

	const student = studentRes.rows[0];

	// fetch latest academic record
	const academic = await studentModel.getLatestAcademicRecordByUsn(student.usn);
	if (!academic) {
		const error = new Error('Academic record not found for student');
		error.statusCode = 404;
		throw error;
	}

	// find active instance for the student's semester
	const instRes = await pool.query(
		`SELECT id, instancename, semester, academic_year, status
		 FROM public.instances
		 WHERE (
		 	semester::text = $1
		 	OR semester::text = ('{' || $1 || '}')
		 )
		 AND status = 'Active'
		 LIMIT 1`,
		[String(Number(academic.semester))]
	);
	if (instRes.rowCount === 0) {
		return { message: 'No active instance for student semester', instance: null };
	}

	const instance = instRes.rows[0];
	const currentSemester = Number(String(instance.semester || '').replace(/[{}]/g, ''));
	const previousSemester = Number.isInteger(currentSemester) && currentSemester > 1
		? currentSemester - 1
		: null;

	// check if student has existing preferences for this active instance
	const prefsRes = await pool.query(
		`SELECT p.preferred, p.final_preference, p.allocation_status, p.status, c.coursename, c.coursecode, p.instance_course_id, eg.group_name
		 FROM public.preferences p
		 JOIN public.instance_courses ic ON ic.id = p.instance_course_id AND ic.instance_id = $1
		 LEFT JOIN public.courses c ON UPPER(TRIM(c.coursecode)) = UPPER(TRIM(ic.coursecode))
		 LEFT JOIN public.elective_group eg ON eg.id = c.elective_group_id
		 WHERE UPPER(p.usn) = UPPER($2)
		 ORDER BY p.preferred ASC, p.instance_course_id ASC`,
		[instance.id, student.usn]
	);

	// fetch all historically allotted course codes for this student.
	// treat a course as allotted when allocation_status = 'Allotted'
	// or when legacy rows satisfy status = final_preference.
	// these are used to validate compulsory prerequisites.
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
		[student.usn]
	);

	const normalizeCode = (value) => String(value || '')
		.toUpperCase()
		.replace(/[\[\]{}()'"`]/g, '')
		.replace(/\s+/g, '')
		.trim();

	const allocatedCourseCodes = allocatedRes.rows
		.map((row) => normalizeCode(row.coursecode))
		.filter(Boolean);

	// also index by course table ID so pre_req values stored as numeric IDs (e.g. '109') match
	const allocatedCourseIds = new Set(
		allocatedRes.rows
			.map((row) => String(row.courseid || '').trim())
			.filter(Boolean)
	);

	// previous-semester allotted courses are used for restricted-course eligibility.
	// treat a course as allotted when allocation_status = 'Allotted'
	// or when legacy rows satisfy status = final_preference.
	const previousAllocatedRes = previousSemester
		? await pool.query(
			`SELECT DISTINCT UPPER(TRIM(ic.coursecode)) AS coursecode
			 FROM public.preferences p
			 JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			 JOIN public.instances i_prev ON i_prev.id = ic.instance_id
			 WHERE UPPER(p.usn) = UPPER($1)
			   AND CAST(REGEXP_REPLACE(i_prev.semester::text, '[{}]', '', 'g') AS INTEGER) = $2
			   AND (
				 UPPER(COALESCE(p.allocation_status, '')) = 'ALLOTTED'
				 OR p.status = p.final_preference
			   )`,
			[student.usn, previousSemester]
		)
		: { rows: [] };

	const previousAllocatedCourseCodes = previousAllocatedRes.rows
		.map((row) => normalizeCode(row.coursecode))
		.filter(Boolean);

	// Fetch all instance courses and evaluate eligibility in JS to keep rule behavior
	// explicit and debuggable.
	const coursesRes = await pool.query(
		`SELECT
			ic.id AS icid,
			ic.*,
			c.coursename,
			c.coursecode,
			c.pre_req,
			c.compulsory_prereq,
			c.department_id,
			c.restricted,
			eg.group_name,
			EXISTS (
				SELECT 1
				FROM public.permitted_branches pb0
				WHERE pb0.instance_course_id = ic.id
			) AS has_branch_rules,
			EXISTS (
				SELECT 1
				FROM public.permitted_branches pb
				WHERE pb.instance_course_id = ic.id
				  AND pb.department_id = $2
			) AS is_department_permitted
		 FROM public.instance_courses ic
		 JOIN public.courses c ON UPPER(TRIM(c.coursecode)) = UPPER(TRIM(ic.coursecode))
		 LEFT JOIN public.elective_group eg ON eg.id = c.elective_group_id
		 WHERE ic.instance_id = $1
		 ORDER BY eg.group_name NULLS LAST, c.coursename ASC, c.coursecode ASC`,
		[instance.id, student.department_id]
	);

	const allocatedSet = new Set(allocatedCourseCodes);
	const previousAllocatedSet = new Set(previousAllocatedCourseCodes);
	// prereq may be stored as course ID (e.g. '109') or course code (e.g. '22EC647')
	const isAllocated = (code) => allocatedSet.has(code) || allocatedCourseIds.has(code);
	const parseCodes = (value) => String(value || '')
		.split(/[;,/|]+/)
		.map((code) => normalizeCode(code))
		.filter(Boolean);

	const grouped = {};
	const eligibleCourseIds = new Set();
	const learntOnlyEligibleCourses = [];
	const eligibilityDebug = [];
	let targetCourseDebug = null;
	for (const row of coursesRes.rows) {
		const reasons = [];
		const hasBranchRules = Boolean(row.has_branch_rules);
		const isDepartmentPermitted = Boolean(row.is_department_permitted);
		const isBranchEligible = !hasBranchRules || isDepartmentPermitted;
		if (!isBranchEligible) reasons.push('not_permitted_for_department');

		const isFloated = !(
			Number(row.division || 0) === 0
			&& Number(row.min_intake || 0) === 0
			&& Number(row.max_intake || 0) === 0
		);
		if (!isFloated) reasons.push('not_floated');

		const restrictedCodes = parseCodes(row.restricted);
		const isRestrictedEligible = (
			restrictedCodes.length === 0
			|| !Number.isInteger(previousSemester)
			|| !restrictedCodes.some((code) => previousAllocatedSet.has(code))
		);
		if (!isRestrictedEligible) reasons.push('restricted_by_previous_semester_allocation');

		const compulsoryFlag = String(row.compulsory_prereq || '').trim().toLowerCase();
		const prereqCodes = parseCodes(row.pre_req);
		const hasSatisfiedPrerequisite = (
			prereqCodes.length === 0
			|| prereqCodes.every((code) => isAllocated(code))
		);
		const hasCompulsoryPrerequisite = (
			compulsoryFlag === 'yes'
				? hasSatisfiedPrerequisite
				: compulsoryFlag === 'learntonly'
					? hasSatisfiedPrerequisite
					: true
		);
		if (!hasCompulsoryPrerequisite) {
			reasons.push(compulsoryFlag === 'learntonly'
				? 'missing_learnt_only_prerequisite'
				: 'missing_compulsory_prerequisite');
		}
		const missingPrereqCodes = prereqCodes.filter((code) => !isAllocated(code));

		const isEligible = isBranchEligible && isFloated && isRestrictedEligible && hasCompulsoryPrerequisite;

		if (normalizeCode(row.coursecode) === '22EC756') {
			targetCourseDebug = {
				coursecode: row.coursecode,
				eligible: isEligible,
				reasons,
				compulsory_prereq: row.compulsory_prereq,
				pre_req: row.pre_req,
				parsed_prereq_codes: prereqCodes,
				missing_prereq_codes: missingPrereqCodes,
				restricted: row.restricted,
				parsed_restricted_codes: restrictedCodes,
				allocatedCourseCodes,
				previousAllocatedCourseCodes,
				has_branch_rules: hasBranchRules,
				is_department_permitted: isDepartmentPermitted,
				division: row.division,
				min_intake: row.min_intake,
				max_intake: row.max_intake,
				currentSemester,
				previousSemester
			};
		}
		if (!isEligible) {
			eligibilityDebug.push({
				coursecode: row.coursecode,
				coursename: row.coursename,
				reasons,
				missing_prereq_codes: missingPrereqCodes,
				compulsory_prereq: row.compulsory_prereq,
				pre_req: row.pre_req,
				restricted: row.restricted,
				has_branch_rules: hasBranchRules,
				is_department_permitted: isDepartmentPermitted,
				division: row.division,
				min_intake: row.min_intake,
				max_intake: row.max_intake
			});
			continue;
		}

		if (compulsoryFlag === 'learntonly' && hasSatisfiedPrerequisite) {
			learntOnlyEligibleCourses.push(row);
		}

		const key = row.group_name || 'No Group';
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(row);
		eligibleCourseIds.add(Number(row.icid));
	}

	let finalGrouped = grouped;
	let finalEligibleCourseIds = new Set(eligibleCourseIds);
	if (learntOnlyEligibleCourses.length > 0) {
		finalGrouped = {};
		finalEligibleCourseIds = new Set();
		for (const row of learntOnlyEligibleCourses) {
			const key = row.group_name || 'No Group';
			if (!finalGrouped[key]) finalGrouped[key] = [];
			finalGrouped[key].push(row);
			finalEligibleCourseIds.add(Number(row.icid));
		}
	}

	const forcedCourseIds = learntOnlyEligibleCourses.map((row) => Number(row.icid));
	const forcedSelection = forcedCourseIds.length > 0;

	if (prefsRes.rowCount > 0) {
		const eligiblePreferences = prefsRes.rows.filter((row) => finalEligibleCourseIds.has(Number(row.instance_course_id)));
		const isFullyRegistered = finalEligibleCourseIds.size > 0 && eligiblePreferences.length === finalEligibleCourseIds.size;

		if (isFullyRegistered) {
			return {
				registered: true,
				preferences: eligiblePreferences,
				forcedSelection,
				forcedCourseIds,
				student: {
					id: student.id,
					department_id: student.department_id,
					usn: student.usn
				},
				allocatedCourseCodes,
				previousAllocatedCourseCodes
			};
		}

		return {
			registered: false,
			instance: { id: instance.id, instancename: instance.instancename },
			courses: finalGrouped,
			existingPreferences: eligiblePreferences,
			forcedSelection,
			forcedCourseIds,
			student: {
				id: student.id,
				department_id: student.department_id,
				usn: student.usn
			},
			allocatedCourseCodes,
			previousAllocatedCourseCodes,
			eligibilityDebug,
			targetCourseDebug
		};
	}

	return {
		registered: false,
		instance: { id: instance.id, instancename: instance.instancename },
		courses: finalGrouped,
		forcedSelection,
		forcedCourseIds,
		student: {
			id: student.id,
			department_id: student.department_id,
			usn: student.usn
		},
		allocatedCourseCodes,
		previousAllocatedCourseCodes,
		eligibilityDebug,
		targetCourseDebug
	};
}

module.exports = {
	getStudents,
	getStudentMeta,
	generateStudentTemplateBuffer,
	importStudentsFromFile,
	addStudent,
	editStudent,
	removeStudent
  ,
  checkName
};