const pool = require('../config/db');

async function listStudents() {
	const result = await pool.query(
		`SELECT s.id,
				s.name,
				s.email,
				s.uid,
				s.usn,
				s.department_id,
				d.name AS department_name,
				d.shortname AS department_shortname,
				ar.semester,
				ar.grade AS cgpa,
				s.created_at,
				s.updated_at
		 FROM public.students s
		 LEFT JOIN public.departments d ON d.deptid = s.department_id
		 LEFT JOIN LATERAL (
		 	SELECT semester, grade
		 	FROM public.student_academic_records sar
		 	WHERE UPPER(sar.usn) = UPPER(s.usn)
		 	ORDER BY sar.updated_at DESC NULLS LAST, sar.id DESC
		 	LIMIT 1
		 ) ar ON TRUE
		 ORDER BY s.id DESC`
	);

	return result.rows;
}

async function getStudentById(id) {
	const result = await pool.query(
		`SELECT s.id,
				s.name,
				s.email,
				s.uid,
				s.usn,
				s.department_id,
				d.name AS department_name,
				d.shortname AS department_shortname,
				ar.semester,
				ar.grade AS cgpa,
				s.created_at,
				s.updated_at
		 FROM public.students s
		 LEFT JOIN public.departments d ON d.deptid = s.department_id
		 LEFT JOIN LATERAL (
		 	SELECT semester, grade
		 	FROM public.student_academic_records sar
		 	WHERE UPPER(sar.usn) = UPPER(s.usn)
		 	ORDER BY sar.updated_at DESC NULLS LAST, sar.id DESC
		 	LIMIT 1
		 ) ar ON TRUE
		 WHERE s.id = $1`,
		[id]
	);

	return result.rows[0] || null;
}

async function createStudent(student) {
	const result = await pool.query(
		`INSERT INTO public.students (
			name,
			email,
			uid,
			usn,
			department_id,
			created_at,
			updated_at
		 ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		 RETURNING id`,
		[
			student.name,
			student.email,
			student.uid,
			student.usn,
			student.department_id
		]
	);

	return getStudentById(result.rows[0].id);
}

async function getLatestAcademicRecordByUsn(usn) {
	const result = await pool.query(
		`SELECT id, usn, semester, grade
		 FROM public.student_academic_records
		 WHERE UPPER(usn) = UPPER($1)
		 ORDER BY updated_at DESC NULLS LAST, id DESC
		 LIMIT 1`,
		[usn]
	);

	return result.rows[0] || null;
}

async function createAcademicRecord({ usn, semester, cgpa }) {
	await pool.query(
		`INSERT INTO public.student_academic_records (
			usn,
			semester,
			grade,
			created_at,
			updated_at
		 ) VALUES ($1, $2, $3, NOW(), NOW())`,
		[usn, String(semester), String(cgpa)]
	);
}

async function updateAcademicRecord(id, { usn, semester, cgpa }) {
	await pool.query(
		`UPDATE public.student_academic_records
		 SET usn = $2,
		 	 semester = $3,
		 	 grade = $4,
		 	 updated_at = NOW()
		 WHERE id = $1`,
		[id, usn, String(semester), String(cgpa)]
	);
}

async function updateAcademicRecordUsn(previousUsn, nextUsn) {
	await pool.query(
		`UPDATE public.student_academic_records
		 SET usn = $2,
		 	 updated_at = NOW()
		 WHERE UPPER(usn) = UPPER($1)`,
		[previousUsn, nextUsn]
	);
}

async function deleteAcademicRecordsByUsn(usn) {
	await pool.query('DELETE FROM public.student_academic_records WHERE UPPER(usn) = UPPER($1)', [usn]);
}

async function updateStudent(id, student) {
	const result = await pool.query(
		`UPDATE public.students
		 SET name = $2,
			 email = $3,
			 uid = $4,
			 usn = $5,
			 department_id = $6,
			 updated_at = NOW()
		 WHERE id = $1
		 RETURNING id`,
		[
			id,
			student.name,
			student.email,
			student.uid,
			student.usn,
			student.department_id
		]
	);

	if (result.rowCount === 0) return null;
	return getStudentById(id);
}

async function deleteStudent(id) {
	const result = await pool.query('DELETE FROM public.students WHERE id = $1 RETURNING id', [id]);
	return result.rowCount > 0;
}

async function findStudentByField(field, value, excludedId = null) {
	const supportedFields = new Set(['email', 'uid', 'usn']);
	if (!supportedFields.has(field)) {
		throw new Error('Unsupported student lookup field');
	}

	const query = excludedId
		? `SELECT id FROM public.students WHERE UPPER(${field}) = UPPER($1) AND id <> $2 LIMIT 1`
		: `SELECT id FROM public.students WHERE UPPER(${field}) = UPPER($1) LIMIT 1`;
	const params = excludedId ? [value, excludedId] : [value];
	const result = await pool.query(query, params);
	return result.rows[0] || null;
}

async function listDepartments() {
	const result = await pool.query(
		`SELECT deptid AS id, name, shortname
		 FROM public.departments
		 ORDER BY name ASC, shortname ASC`
	);

	return result.rows;
}

async function departmentExists(id) {
	const result = await pool.query('SELECT deptid FROM public.departments WHERE deptid = $1 LIMIT 1', [id]);
	return result.rowCount > 0;
}

module.exports = {
	listStudents,
	getStudentById,
	createStudent,
	updateStudent,
	deleteStudent,
	getLatestAcademicRecordByUsn,
	createAcademicRecord,
	updateAcademicRecord,
	updateAcademicRecordUsn,
	deleteAcademicRecordsByUsn,
	findStudentByField,
	listDepartments,
	departmentExists
};