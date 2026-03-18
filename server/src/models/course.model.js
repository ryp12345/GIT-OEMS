const pool = require('../config/db');

async function listCourses() {
	const result = await pool.query(
		`SELECT c.id,
				c.elective_group_id,
				eg.group_name AS elective_group_name,
				c.coursename,
				c.coursecode,
				c.pre_req,
				c.department_id,
				d.name AS department_name,
				d.shortname AS department_shortname,
				c.semester,
				c.compulsory_prereq,
				c.restricted,
				c.created_at,
				c.updated_at
		 FROM public.courses c
		 LEFT JOIN public.departments d ON d.deptid = c.department_id
		 LEFT JOIN public.elective_group eg ON eg.id = c.elective_group_id
		 ORDER BY c.semester ASC, c.coursecode ASC`
	);

	return result.rows;
}

async function getCourseById(id) {
	const result = await pool.query(
		`SELECT id,
				elective_group_id,
				coursename,
				coursecode,
				pre_req,
				department_id,
				semester,
				compulsory_prereq,
				restricted,
				created_at,
				updated_at
		 FROM public.courses
		 WHERE id = $1`,
		[id]
	);

	return result.rows[0] || null;
}

async function createCourse(course) {
	const result = await pool.query(
		`INSERT INTO public.courses (
			elective_group_id,
			coursename,
			coursecode,
			pre_req,
			department_id,
			semester,
			compulsory_prereq,
			restricted,
			created_at,
			updated_at
		 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		 RETURNING id`,
		[
			course.elective_group_id,
			course.coursename,
			course.coursecode,
			course.pre_req,
			course.department_id,
			course.semester,
			course.compulsory_prereq,
			course.restricted
		]
	);

	return getCourseById(result.rows[0].id);
}

async function updateCourse(id, course) {
	const result = await pool.query(
		`UPDATE public.courses
		 SET elective_group_id = $2,
			 coursename = $3,
			 coursecode = $4,
			 pre_req = $5,
			 department_id = $6,
			 semester = $7,
			 compulsory_prereq = $8,
			 restricted = $9,
			 updated_at = NOW()
		 WHERE id = $1
		 RETURNING id`,
		[
			id,
			course.elective_group_id,
			course.coursename,
			course.coursecode,
			course.pre_req,
			course.department_id,
			course.semester,
			course.compulsory_prereq,
			course.restricted
		]
	);

	if (result.rowCount === 0) return null;
	return getCourseById(id);
}

async function deleteCourse(id) {
	const result = await pool.query('DELETE FROM public.courses WHERE id = $1 RETURNING id', [id]);
	return result.rowCount > 0;
}

async function findCourseByCode(coursecode, excludedId = null) {
	const query = excludedId
		? 'SELECT id FROM public.courses WHERE UPPER(coursecode) = $1 AND id <> $2 LIMIT 1'
		: 'SELECT id FROM public.courses WHERE UPPER(coursecode) = $1 LIMIT 1';
	const params = excludedId ? [coursecode, excludedId] : [coursecode];
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

async function listElectiveGroups() {
	const result = await pool.query(
		`SELECT id, group_name
		 FROM public.elective_group
		 ORDER BY group_name ASC`
	);

	return result.rows;
}

module.exports = {
	listCourses,
	getCourseById,
	createCourse,
	updateCourse,
	deleteCourse,
	findCourseByCode,
	listDepartments,
	listElectiveGroups
};