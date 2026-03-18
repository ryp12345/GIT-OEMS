const studentModel = require('../models/student.model');
const XLSX = require('xlsx');

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

async function getStudents() {
	return studentModel.listStudents();
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

async function importStudentsFromFile(fileBuffer) {
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
		}, {}))
		.filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));

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
		await ensureUniqueStudentFields(payload);
		const createdStudent = await studentModel.createStudent(payload);
		await studentModel.createAcademicRecord(payload);
		importedStudents.push(await studentModel.getStudentById(createdStudent.id));
	}

	return {
		importedCount: importedStudents.length,
		students: importedStudents
	};
}

async function addStudent(payload) {
	const student = normalizePayload(payload);
	await ensureDepartmentExists(student.department_id);
	await ensureUniqueStudentFields(student);
	const createdStudent = await studentModel.createStudent(student);
	await studentModel.createAcademicRecord(student);
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
		await studentModel.updateAcademicRecord(academicRecord.id, student);
	} else {
		await studentModel.createAcademicRecord(student);
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

module.exports = {
	getStudents,
	getStudentMeta,
	generateStudentTemplateBuffer,
	importStudentsFromFile,
	addStudent,
	editStudent,
	removeStudent
};