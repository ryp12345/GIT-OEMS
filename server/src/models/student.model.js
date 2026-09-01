const pool = require('../config/db');

async function listStudents(instanceId, prefStatus = null) {
	// prefStatus: null | 'submitted' | 'pending'
	const hasInstance = Boolean(instanceId && Number.isInteger(Number(instanceId)));

	const baseSelect = `SELECT s.id,
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
		 LEFT JOIN public.departments d ON d.deptid = s.department_id`;

	const lateralAcademic = hasInstance
		? `INNER JOIN LATERAL (
			SELECT semester, grade
			FROM public.student_academic_records sar
			WHERE LOWER(REGEXP_REPLACE(sar.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
			  AND sar.instance_id = $1
			ORDER BY sar.updated_at DESC NULLS LAST, sar.id DESC
			LIMIT 1
		 ) ar ON TRUE`
		: `LEFT JOIN LATERAL (
			SELECT semester, grade
			FROM public.student_academic_records sar
			WHERE LOWER(REGEXP_REPLACE(sar.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
			ORDER BY sar.updated_at DESC NULLS LAST, sar.id DESC
			LIMIT 1
		 ) ar ON TRUE`;

	let whereClause = '';
	const params = [];

	if (hasInstance) {
		params.push(Number(instanceId));
	}

	if (prefStatus && hasInstance) {
		if (String(prefStatus).toLowerCase() === 'submitted') {
			whereClause = `WHERE EXISTS (
				SELECT 1 FROM public.preferences p
				JOIN public.instance_courses ic ON ic.id = p.instance_course_id
				WHERE ic.instance_id = $1
				  AND LOWER(REGEXP_REPLACE(p.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
			)`;
		} else if (String(prefStatus).toLowerCase() === 'pending') {
			whereClause = `WHERE NOT EXISTS (
				SELECT 1 FROM public.preferences p
				JOIN public.instance_courses ic ON ic.id = p.instance_course_id
				WHERE ic.instance_id = $1
				  AND LOWER(REGEXP_REPLACE(p.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
			)`;
		}
	}

	const orderBy = 'ORDER BY s.id DESC';

	const query = `${baseSelect} ${lateralAcademic} ${whereClause} ${orderBy}`;

	const result = await pool.query(query, params);
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

async function getStudentByUsn(usn) {
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
			 WHERE UPPER(s.usn) = UPPER($1)
			 LIMIT 1`,
		[usn]
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
		`SELECT id, usn, semester, grade, instance_id
		 FROM public.student_academic_records
		 WHERE UPPER(usn) = UPPER($1)
		 ORDER BY updated_at DESC NULLS LAST, id DESC
		 LIMIT 1`,
		[usn]
	);

	return result.rows[0] || null;
}

async function getAcademicRecordByUsnAndSemester(usn, semester, instanceId) {
	const result = await pool.query(
		`SELECT id, usn, semester, grade, instance_id
		 FROM public.student_academic_records
		 WHERE UPPER(usn) = UPPER($1)
		   AND CAST(semester AS INTEGER) = $2
		   AND instance_id = $3
		 ORDER BY updated_at DESC NULLS LAST, id DESC
		 LIMIT 1`,
		[usn, Number(semester), Number(instanceId)]
	);

	return result.rows[0] || null;
}

async function createAcademicRecord({ usn, semester, cgpa, instance_id }) {
	await pool.query(
		`INSERT INTO public.student_academic_records (
			usn,
			semester,
			grade,
			instance_id,
			created_at,
			updated_at
		 ) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
		[usn, String(semester), String(cgpa), Number(instance_id)]
	);
}

async function updateAcademicRecord(id, { usn, semester, cgpa, instance_id }) {
	await pool.query(
		`UPDATE public.student_academic_records
		 SET usn = $2,
		 	 semester = $3,
		 	 grade = $4,
		 	 instance_id = $5,
		 	 updated_at = NOW()
		 WHERE id = $1`,
		[id, usn, String(semester), String(cgpa), Number(instance_id)]
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

async function updateStudentEmailByUsn(usn, email) {
	const result = await pool.query(
		`UPDATE public.students
		 SET email = $2,
			 updated_at = NOW()
		 WHERE UPPER(usn) = UPPER($1)
		 RETURNING id`,
		[usn, email]
	);

	return result.rowCount > 0;
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

async function findStudentsForImport({ email, uid, usn }) {
	const result = await pool.query(
		`SELECT id,
				name,
				email,
				uid,
				usn,
				department_id
		 FROM public.students
		 WHERE UPPER(email) = UPPER($1)
		    OR UPPER(uid) = UPPER($2)
		    OR UPPER(usn) = UPPER($3)
		 ORDER BY id ASC`,
		[email, uid, usn]
	);

	return result.rows;
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
	getStudentByUsn,
	createStudent,
	updateStudent,
	updateStudentEmailByUsn,
	deleteStudent,
	getLatestAcademicRecordByUsn,
	getAcademicRecordByUsnAndSemester,
	createAcademicRecord,
	updateAcademicRecord,
	updateAcademicRecordUsn,
	deleteAcademicRecordsByUsn,
	findStudentByField,
	findStudentsForImport,
	listDepartments,
	departmentExists
};