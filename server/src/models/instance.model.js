const pool = require('../config/db');

async function listInstances() {
	const result = await pool.query(
		`SELECT id, instancename, semester, academic_year, status
		 FROM public.instances
		 ORDER BY academic_year DESC, semester ASC, instancename ASC`
	);

	return result.rows;
}

async function getInstanceById(id) {
	const result = await pool.query(
		`SELECT id, instancename, semester, academic_year, status
		 FROM public.instances
		 WHERE id = $1`,
		[id]
	);

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

async function listInstanceCourses(instanceId) {
	const result = await pool.query(
		`SELECT c.coursecode,
				c.coursename,
				c.department_id,
				d.shortname,
				ic.id AS instance_course_id,
				ic.division,
				ic.min_intake,
				ic.max_intake,
				COALESCE(
					ARRAY_REMOVE(ARRAY_AGG(pb.department_id ORDER BY pb.department_id), NULL),
					'{}'
				) AS department_ids
		 FROM public.instances i
		 JOIN public.courses c ON c.semester = i.semester
		 LEFT JOIN public.departments d ON d.deptid = c.department_id
		 LEFT JOIN public.instance_courses ic
		 	ON ic.instance_id = i.id
			AND UPPER(ic.coursecode) = UPPER(c.coursecode)
		 LEFT JOIN public.permitted_branches pb ON pb.instance_course_id = ic.id
		 WHERE i.id = $1
		 GROUP BY c.coursecode, c.coursename, c.department_id, d.shortname, ic.id, ic.division, ic.min_intake, ic.max_intake
		 ORDER BY d.shortname ASC, c.coursename ASC, c.coursecode ASC`,
		[instanceId]
	);

	return result.rows.map((row) => ({
		...row,
		department_ids: Array.isArray(row.department_ids)
			? row.department_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
			: []
	}));
}

async function saveInstanceCourseMappings(instanceId, courseMappings) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (const mapping of courseMappings) {
			const existingResult = await client.query(
				`SELECT id
				 FROM public.instance_courses
				 WHERE instance_id = $1 AND UPPER(coursecode) = UPPER($2)
				 LIMIT 1`,
				[instanceId, mapping.coursecode]
			);

			let instanceCourseId = existingResult.rows[0]?.id || null;

			if (instanceCourseId) {
				await client.query(
					`UPDATE public.instance_courses
					 SET division = $3,
					 	 min_intake = $4,
					 	 max_intake = $5
					 WHERE instance_id = $1 AND UPPER(coursecode) = UPPER($2)`,
					[instanceId, mapping.coursecode, mapping.division, mapping.min_intake, mapping.max_intake]
				);
			} else {
				const insertResult = await client.query(
					`INSERT INTO public.instance_courses (
						instance_id,
						coursecode,
						division,
						min_intake,
						max_intake,
						total_allocations,
						allocation_status
					 ) VALUES ($1, $2, $3, $4, $5, 0, 'Pending')
					 RETURNING id`,
					[instanceId, mapping.coursecode, mapping.division, mapping.min_intake, mapping.max_intake]
				);

				instanceCourseId = insertResult.rows[0].id;
			}

			await client.query('DELETE FROM public.permitted_branches WHERE instance_course_id = $1', [instanceCourseId]);

			for (const departmentId of mapping.department_ids) {
				await client.query(
					`INSERT INTO public.permitted_branches (instance_course_id, department_id)
					 VALUES ($1, $2)`,
					[instanceCourseId, departmentId]
				);
			}
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function createInstance({ instancename, semester, academic_year, status }) {
	const result = await pool.query(
		`INSERT INTO public.instances (instancename, semester, academic_year, status)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, instancename, semester, academic_year, status`,
		[instancename, semester, academic_year, status]
	);

	return result.rows[0];
}

async function updateInstance(id, { instancename, semester, academic_year, status }) {
	const result = await pool.query(
		`UPDATE public.instances
		 SET instancename = $2,
			 semester = $3,
			 academic_year = $4,
			 status = $5
		 WHERE id = $1
		 RETURNING id, instancename, semester, academic_year, status`,
		[id, instancename, semester, academic_year, status]
	);

	return result.rows[0] || null;
}

async function deleteInstance(id) {
	const result = await pool.query('DELETE FROM public.instances WHERE id = $1 RETURNING id', [id]);
	return result.rowCount > 0;
}

async function getPreferenceStatisticsByInstance(instanceId) {
	const result = await pool.query(
		`SELECT 
			d.deptid AS id,
			d.shortname AS department,
			COUNT(DISTINCT s.id) AS total_students,
			COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN s.id END) AS submitted_preferences
		 FROM public.instances i
		 JOIN public.student_academic_records sar ON CAST(sar.semester AS INTEGER) = i.semester
		 JOIN public.students s ON s.usn = sar.usn
		 JOIN public.departments d ON d.deptid = s.department_id
		 LEFT JOIN public.preferences p ON p.usn = s.usn 
			AND p.instance_course_id IN (
				SELECT id FROM public.instance_courses WHERE instance_id = i.id
			)
		 WHERE i.id = $1
		 GROUP BY d.deptid, d.shortname, d.name
		 ORDER BY d.shortname ASC`,
		[instanceId]
	);

	return result.rows.map((row, index) => ({
		slNo: index + 1,
		department: row.department,
		submitted: Number(row.submitted_preferences) || 0,
		pending: Number(row.total_students) - (Number(row.submitted_preferences) || 0),
		total: Number(row.total_students) || 0
	}));
}

async function getPreferenceStatisticsDetailsByInstance(instanceId) {
	const detailsResult = await pool.query(
		`WITH preference_data AS (
			SELECT
				p.instance_course_id,
				p.preferred,
				p.final_preference,
				NULLIF(REGEXP_REPLACE(COALESCE(sar.grade, ''), '[^0-9.]', '', 'g'), '')::NUMERIC AS grade_num
			FROM public.preferences p
			JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			JOIN public.instances i ON i.id = ic.instance_id
			LEFT JOIN public.student_academic_records sar
				ON sar.usn = p.usn
				AND CAST(sar.semester AS INTEGER) = i.semester
			WHERE ic.instance_id = $1
		)
		SELECT
			ic.id AS instance_course_id,
			c.coursename,
			ic.coursecode,
			COUNT(*) FILTER (WHERE pd.preferred = 1) AS p1_count,
			MIN(pd.grade_num) FILTER (WHERE pd.preferred = 1) AS p1_min_grade,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pd.grade_num) FILTER (WHERE pd.preferred = 1) AS p1_median_grade,
			MAX(pd.grade_num) FILTER (WHERE pd.preferred = 1) AS p1_max_grade,
			COUNT(*) FILTER (WHERE pd.preferred = 2) AS p2_count,
			MIN(pd.grade_num) FILTER (WHERE pd.preferred = 2) AS p2_min_grade,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pd.grade_num) FILTER (WHERE pd.preferred = 2) AS p2_median_grade,
			MAX(pd.grade_num) FILTER (WHERE pd.preferred = 2) AS p2_max_grade,
			ic.division,
			ic.min_intake,
			ic.max_intake,
			COALESCE(ic.total_allocations, 0) AS total_allocations,
			COALESCE(NULLIF(ic.allocation_status, ''), 'Pending') AS allocation_status
		FROM public.instance_courses ic
		JOIN public.courses c ON UPPER(c.coursecode) = UPPER(ic.coursecode)
		LEFT JOIN preference_data pd ON pd.instance_course_id = ic.id
		WHERE ic.instance_id = $1
		GROUP BY ic.id, c.coursename, ic.coursecode, ic.division, ic.min_intake, ic.max_intake, ic.total_allocations, ic.allocation_status
		ORDER BY c.coursename ASC, ic.coursecode ASC`,
		[instanceId]
	);

	const chartResult = await pool.query(
		`WITH chart_data AS (
			SELECT
				p.instance_course_id,
				p.final_preference,
				CASE
					WHEN g.grade_num IS NULL THEN 'Unknown'
					WHEN g.grade_num < 5 THEN '0-4.99'
					WHEN g.grade_num < 6 THEN '5-5.99'
					WHEN g.grade_num < 7 THEN '6-6.99'
					WHEN g.grade_num < 8 THEN '7-7.99'
					WHEN g.grade_num < 9 THEN '8-8.99'
					ELSE '9-10'
				END AS grade_range,
				COUNT(*) AS no_of_allocations
			FROM public.preferences p
			JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			JOIN public.instances i ON i.id = ic.instance_id
			LEFT JOIN LATERAL (
				SELECT NULLIF(REGEXP_REPLACE(COALESCE(sar.grade, ''), '[^0-9.]', '', 'g'), '')::NUMERIC AS grade_num
				FROM public.student_academic_records sar
				WHERE sar.usn = p.usn
				  AND CAST(sar.semester AS INTEGER) = i.semester
				LIMIT 1
			) g ON true
			WHERE ic.instance_id = $1
			  AND LOWER(COALESCE(p.allocation_status, '')) = 'allotted'
			GROUP BY p.instance_course_id, p.final_preference, grade_range
		)
		SELECT instance_course_id, grade_range, final_preference, no_of_allocations
		FROM chart_data
		ORDER BY instance_course_id ASC, grade_range ASC, final_preference ASC`,
		[instanceId]
	);

	const colorPalette = [
		'rgba(210, 214, 222, 1)',
		'rgba(0, 166, 90, 1)',
		'rgba(60, 141, 188, 1)',
		'rgba(243, 156, 18, 1)',
		'rgba(221, 75, 57, 1)',
		'rgba(0, 192, 239, 1)',
		'rgba(96, 92, 168, 1)',
		'rgba(255, 193, 7, 1)',
		'rgba(40, 167, 69, 1)',
		'rgba(255, 99, 132, 1)'
	];

	const chartByCourse = new Map();
	for (const row of chartResult.rows) {
		const key = row.instance_course_id;
		if (!chartByCourse.has(key)) {
			chartByCourse.set(key, new Map());
		}

		const rangeMap = chartByCourse.get(key);
		if (!rangeMap.has(row.grade_range)) {
			rangeMap.set(row.grade_range, {});
		}

		rangeMap.get(row.grade_range)[Number(row.final_preference)] = Number(row.no_of_allocations) || 0;
	}

	return detailsResult.rows.map((row) => {
		const rangeMap = chartByCourse.get(row.instance_course_id) || new Map();
		const chartData = Array.from(rangeMap.entries()).map(([gradeRange, preferences], index) => ({
			label: gradeRange,
			data: [1, 2, 3, 4, 5].map((preference) => Number(preferences[preference] || 0)),
			backgroundColor: colorPalette[index % colorPalette.length],
			borderColor: 'rgba(210, 214, 222, 1)',
			borderWidth: 1
		}));

		return {
			coursename: row.coursename,
			coursecode: row.coursecode,
			p1_count: Number(row.p1_count) || 0,
			p2_count: Number(row.p2_count) || 0,
			p1_min_grade: row.p1_min_grade != null ? Number(row.p1_min_grade) : null,
			p2_min_grade: row.p2_min_grade != null ? Number(row.p2_min_grade) : null,
			p1_max_grade: row.p1_max_grade != null ? Number(row.p1_max_grade) : null,
			p2_max_grade: row.p2_max_grade != null ? Number(row.p2_max_grade) : null,
			p1_median_grade: row.p1_median_grade != null ? Number(row.p1_median_grade) : null,
			p2_median_grade: row.p2_median_grade != null ? Number(row.p2_median_grade) : null,
			division: Number(row.division) || 0,
			min_intake: Number(row.min_intake) || 0,
			max_intake: Number(row.max_intake) || 0,
			total_allocations: Number(row.total_allocations) || 0,
			allocation_status: row.allocation_status || 'Pending',
			chartData
		};
	});
}

async function resetAllocationsByInstance(instanceId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		await client.query(
			`UPDATE public.preferences p
			 SET allocation_status = 'Pending'
			 FROM public.instance_courses ic
			 WHERE p.instance_course_id = ic.id
			   AND ic.instance_id = $1`,
			[instanceId]
		);

		await client.query(
			`UPDATE public.instance_courses
			 SET total_allocations = 0,
			     allocation_status = 'Pending'
			 WHERE instance_id = $1`,
			[instanceId]
		);

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

module.exports = {
	listInstances,
	getInstanceById,
	listDepartments,
	listInstanceCourses,
	saveInstanceCourseMappings,
	createInstance,
	updateInstance,
	deleteInstance,
	getPreferenceStatisticsByInstance,
	getPreferenceStatisticsDetailsByInstance,
	resetAllocationsByInstance
};