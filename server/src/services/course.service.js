const courseModel = require('../models/course.model');
const XLSX = require('xlsx');

const VALID_SEMESTERS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const VALID_YES_NO = new Set(['Yes', 'No', '']);

function normalizeOptionalId(value) {
	if (value === '' || value === null || value === undefined) return null;
	const numericValue = Number(value);
	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		const error = new Error('Invalid lookup value');
		error.statusCode = 400;
		throw error;
	}
	return numericValue;
}

function normalizePayload(payload = {}) {
	const coursename = String(payload.coursename || '').trim();
	const coursecode = String(payload.coursecode || '').trim().toUpperCase();
	const pre_req = String(payload.pre_req || '').trim();
	const restricted = String(payload.restricted || '').trim();
	const compulsory_prereq = String(payload.compulsory_prereq || 'No').trim();
	const semester = Number(payload.semester);
	const department_id = normalizeOptionalId(payload.department_id);
	const elective_group_id = normalizeOptionalId(payload.elective_group_id);

	if (!coursename) {
		const error = new Error('Course name is required');
		error.statusCode = 400;
		throw error;
	}

	if (!coursecode || coursecode.length > 10) {
		const error = new Error('Course code is required and must be at most 10 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!VALID_SEMESTERS.has(semester)) {
		const error = new Error('Semester must be between 1 and 8');
		error.statusCode = 400;
		throw error;
	}

	if (!department_id) {
		const error = new Error('Offering department is required');
		error.statusCode = 400;
		throw error;
	}

	if (pre_req.length > 200) {
		const error = new Error('Prerequisite must be at most 200 characters');
		error.statusCode = 400;
		throw error;
	}

	if (!VALID_YES_NO.has(compulsory_prereq)) {
		const error = new Error('Compulsory prerequisite must be Yes or No');
		error.statusCode = 400;
		throw error;
	}

	if (restricted.length > 10) {
		const error = new Error('Restricted field must be at most 10 characters');
		error.statusCode = 400;
		throw error;
	}

	return {
		coursename,
		coursecode,
		pre_req: pre_req || null,
		restricted: restricted || null,
		compulsory_prereq: compulsory_prereq || 'No',
		semester,
		department_id,
		elective_group_id
	};
}

async function ensureUniqueCourseCode(coursecode, excludedId = null) {
	const existing = await courseModel.findCourseByCode(coursecode, excludedId);
	if (existing) {
		const error = new Error('Course code already exists');
		error.statusCode = 409;
		throw error;
	}
}

async function getCourses() {
	return courseModel.listCourses();
}

async function getCourseMeta() {
	const [departments, electiveGroups] = await Promise.all([
		courseModel.listDepartments(),
		courseModel.listElectiveGroups()
	]);

	return { departments, electiveGroups };
}

async function generateCourseTemplateBuffer() {
	const [departments, electiveGroups] = await Promise.all([
		courseModel.listDepartments(),
		courseModel.listElectiveGroups()
	]);

	const workbook = XLSX.utils.book_new();
	const worksheet = XLSX.utils.aoa_to_sheet([]);

	XLSX.utils.sheet_add_aoa(worksheet, [[
		'elective_group_id',
		'CourseName',
		'CourseCode',
		'Prerequisites',
		'Is Prerequesities Compulsory(1,0)',
		'RestrictedCourseCode',
		'Department ID',
		'Semester'
	]], { origin: 'A1' });

	XLSX.utils.sheet_add_aoa(worksheet, [
		['1', 'POWER SYSTEM ANALYSIS AND STABILITY', '21EE61', 'Knowledge of basic electricals', '0', '', '4', '5'],
		['2', 'POWER ELECTRONICS', '21EE62', '21EE51', '1', '21EE52', '4', '5']
	], { origin: 'A2' });

	XLSX.utils.sheet_add_aoa(worksheet, [['Department ID', 'Department Name']], { origin: 'N1' });
	XLSX.utils.sheet_add_aoa(
		worksheet,
		departments.map((department) => [department.id, department.name]),
		{ origin: 'N2' }
	);

	XLSX.utils.sheet_add_aoa(worksheet, [['Elective Group ID', 'Elective Group Name']], { origin: 'R1' });
	XLSX.utils.sheet_add_aoa(
		worksheet,
		electiveGroups.map((group) => [group.id, group.group_name]),
		{ origin: 'R2' }
	);

	worksheet['!cols'] = [
		{ wch: 18 },
		{ wch: 38 },
		{ wch: 18 },
		{ wch: 34 },
		{ wch: 32 },
		{ wch: 22 },
		{ wch: 16 },
		{ wch: 12 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 16 },
		{ wch: 32 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 18 },
		{ wch: 28 }
	];

	XLSX.utils.book_append_sheet(workbook, worksheet, 'Course Template');
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

function normalizeYesNo(value) {
	const normalized = String(value || '').trim().toLowerCase();
	if (!normalized) return 'No';
	if (['yes', 'y', 'true', '1'].includes(normalized)) return 'Yes';
	if (['no', 'n', 'false', '0'].includes(normalized)) return 'No';

	const error = new Error('Compulsory prerequisite must be Yes or No');
	error.statusCode = 400;
	throw error;
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

async function importCoursesFromFile(fileBuffer) {
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

	const [departments, electiveGroups, existingCourses] = await Promise.all([
		courseModel.listDepartments(),
		courseModel.listElectiveGroups(),
		courseModel.listCourses()
	]);

	const departmentLookup = createLookupMap(departments, [
		(item) => item.name,
		(item) => item.shortname,
		(item) => item.id
	]);
	const electiveGroupLookup = createLookupMap(electiveGroups, [
		(item) => item.group_name,
		(item) => item.id
	]);
	const courseLookup = createLookupMap(existingCourses, [
		(item) => item.coursecode,
		(item) => item.id
	]);

	const importedCourses = [];

	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const rowNumber = index + 2;
		const coursecode = getRowValue(row, ['coursecode', 'course_code']);
		const coursename = getRowValue(row, ['coursename', 'course_name']);
		const semester = getRowValue(row, ['semester']);
		const departmentValue = getRowValue(row, ['department_id', 'deptid', 'department', 'department_name', 'offering_department']);
		const electiveGroupValue = getRowValue(row, ['elective_group_id', 'elective_group', 'elective_group_name', 'group_name']);
		const prerequisiteType = getRowValue(row, ['pre_req_type', 'prereq_type', 'pre_requisite_type']);
		const prerequisiteValue = getRowValue(row, ['pre_req', 'pre_req_value', 'prereq', 'pre_requisite', 'pre_requisite_value', 'prerequisites']);
		const restrictedValue = getRowValue(row, ['restricted', 'restricted_course', 'restricted_course_code', 'restrictedcoursecode']);
		const compulsoryValue = getRowValue(row, ['compulsory_prereq', 'compulsory_pre_requisite', 'compulsory_prerequisite', 'is_prerequesities_compulsory10']);

		const hasAnyCourseField = [
			coursecode,
			coursename,
			semester,
			prerequisiteType,
			prerequisiteValue,
			restrictedValue,
			compulsoryValue
		].some((value) => Boolean(String(value || '').trim()));

		if (!hasAnyCourseField) {
			continue;
		}

		if (!coursecode || !coursename || !semester || !departmentValue) {
			const error = new Error(`Row ${rowNumber}: course code, course name, semester, and department are required`);
			error.statusCode = 400;
			throw error;
		}

		const department = departmentLookup.get(departmentValue.toLowerCase());
		if (!department) {
			const error = new Error(`Row ${rowNumber}: department "${departmentValue}" was not found`);
			error.statusCode = 400;
			throw error;
		}

		const electiveGroup = electiveGroupValue
			? electiveGroupLookup.get(electiveGroupValue.toLowerCase())
			: null;
		if (electiveGroupValue && !electiveGroup) {
			const error = new Error(`Row ${rowNumber}: elective group "${electiveGroupValue}" was not found`);
			error.statusCode = 400;
			throw error;
		}

		let normalizedPrerequisite = '';
		const normalizedPrereqType = prerequisiteType.toLowerCase();
		if (prerequisiteValue) {
			if (normalizedPrereqType === 'text') {
				normalizedPrerequisite = prerequisiteValue;
			} else {
				const prerequisiteCourse = courseLookup.get(prerequisiteValue.toLowerCase());
				if (prerequisiteCourse) {
					normalizedPrerequisite = String(prerequisiteCourse.id);
				} else if (!normalizedPrereqType) {
					normalizedPrerequisite = prerequisiteValue;
				} else {
					const error = new Error(`Row ${rowNumber}: prerequisite course "${prerequisiteValue}" was not found. Use an existing course code or set Pre Req Type to Text.`);
					error.statusCode = 400;
					throw error;
				}
			}
		}

		let normalizedRestricted = null;
		if (restrictedValue) {
			const restrictedCourse = courseLookup.get(restrictedValue.toLowerCase());
			if (restrictedCourse) {
				normalizedRestricted = String(restrictedCourse.id);
			} else {
				// Keep unresolved restricted value as course code/text.
				normalizedRestricted = restrictedValue;
			}
		}

		const payload = normalizePayload({
			coursename,
			coursecode,
			semester,
			department_id: department.id,
			elective_group_id: electiveGroup ? electiveGroup.id : null,
			pre_req: normalizedPrerequisite,
			restricted: normalizedRestricted,
			compulsory_prereq: normalizeYesNo(compulsoryValue)
		});

		await ensureUniqueCourseCode(payload.coursecode);
		const created = await courseModel.createCourse(payload);
		courseLookup.set(payload.coursecode.toLowerCase(), created);
		courseLookup.set(String(created.id), created);
		importedCourses.push(created);
	}

	if (importedCourses.length === 0) {
		const error = new Error('Uploaded file does not contain any course rows');
		error.statusCode = 400;
		throw error;
	}

	return {
		importedCount: importedCourses.length,
		courses: importedCourses
	};
}

async function addCourse(payload) {
	const normalized = normalizePayload(payload);
	await ensureUniqueCourseCode(normalized.coursecode);
	return courseModel.createCourse(normalized);
}

async function editCourse(id, payload) {
	const numericId = Number(id);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid course id');
		error.statusCode = 400;
		throw error;
	}

	const normalized = normalizePayload(payload);
	await ensureUniqueCourseCode(normalized.coursecode, numericId);
	const updated = await courseModel.updateCourse(numericId, normalized);

	if (!updated) {
		const error = new Error('Course not found');
		error.statusCode = 404;
		throw error;
	}

	return updated;
}

async function removeCourse(id) {
	const numericId = Number(id);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		const error = new Error('Invalid course id');
		error.statusCode = 400;
		throw error;
	}

	const deleted = await courseModel.deleteCourse(numericId);
	if (!deleted) {
		const error = new Error('Course not found');
		error.statusCode = 404;
		throw error;
	}

	return true;
}

module.exports = {
	getCourses,
	getCourseMeta,
	generateCourseTemplateBuffer,
	addCourse,
	editCourse,
	removeCourse,
	importCoursesFromFile
};