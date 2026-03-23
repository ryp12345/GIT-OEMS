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
	// Only return courses that are explicitly mapped for the instance (via instance_courses)
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
		FROM public.instance_courses ic
		JOIN public.instances i ON i.id = ic.instance_id
		JOIN public.courses c ON UPPER(c.coursecode) = UPPER(ic.coursecode)
		LEFT JOIN public.departments d ON d.deptid = c.department_id
		LEFT JOIN public.permitted_branches pb ON pb.instance_course_id = ic.id
		WHERE ic.instance_id = $1
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

async function getPreferenceStatisticsDetailsByInstance(instanceId, options = {}) {
	const strictSarJoin = options.strictSarJoin !== false;
	const strictCourseFilterClause = strictSarJoin ? 'HAVING COUNT(pd.instance_course_id) > 0' : '';
	const sarJoinClause = strictSarJoin
		? `JOIN public.student_academic_records sar
			ON sar.usn = p.usn
			AND CAST(sar.semester AS INTEGER) = i.semester`
		: `LEFT JOIN public.student_academic_records sar
			ON sar.usn = p.usn
			AND CAST(sar.semester AS INTEGER) = i.semester`;

	const [detailsResult, chartResult] = await Promise.all([
		pool.query(
		`WITH preference_data AS (
			SELECT
				p.instance_course_id,
				p.preferred,
				p.final_preference,
				NULLIF(REGEXP_REPLACE(COALESCE(sar.grade, ''), '[^0-9.]', '', 'g'), '')::NUMERIC AS grade_num
			FROM public.preferences p
			JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			JOIN public.instances i ON i.id = ic.instance_id
			${sarJoinClause}
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
		JOIN public.instances i ON i.id = ic.instance_id
		JOIN public.courses c ON UPPER(c.coursecode) = UPPER(ic.coursecode)
			AND CAST(c.semester AS INTEGER) = i.semester
		LEFT JOIN preference_data pd ON pd.instance_course_id = ic.id
		WHERE ic.instance_id = $1
		GROUP BY ic.id, c.coursename, ic.coursecode, ic.division, ic.min_intake, ic.max_intake, ic.total_allocations, ic.allocation_status
		${strictCourseFilterClause}
		ORDER BY c.coursename ASC, ic.coursecode ASC`,
		[instanceId]
		),

		pool.query(
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
			  AND p.status = p.final_preference
			GROUP BY p.instance_course_id, p.final_preference, grade_range
		)
		SELECT instance_course_id, grade_range, final_preference, no_of_allocations
		FROM chart_data
		ORDER BY instance_course_id ASC, grade_range ASC, final_preference ASC`,
		[instanceId]
		)
	]);

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

	const rows = detailsResult.rows.map((row) => {
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

	const grandTotalAllocations = rows.reduce(
		(sum, row) => sum + (Number(row.total_allocations) || 0),
		0
	);

	return {
		rows,
		grandTotalAllocations
	};
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

async function runAllocationByInstance(instanceId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// 1) Initialize final_preference = preferred for all preferences in this instance
		await client.query(
			`UPDATE public.preferences p
			 SET final_preference = p.preferred
			 FROM public.instance_courses ic
			 WHERE p.instance_course_id = ic.id
			   AND ic.instance_id = $1`,
			[instanceId]
		);

		// 2) Reject under-subscribed courses (preferred=1 count < min_intake)
		const underSubscribedRes = await client.query(
			`SELECT ic.id
			 FROM public.instance_courses ic
			 LEFT JOIN (
				SELECT instance_course_id, COUNT(*) FILTER (WHERE preferred = 1) AS p1_count
				FROM public.preferences
				GROUP BY instance_course_id
			 ) pref ON pref.instance_course_id = ic.id
			 WHERE ic.instance_id = $1
			   AND COALESCE(pref.p1_count, 0) < COALESCE(ic.min_intake, 0)`,
			[instanceId]
		);

		for (const row of underSubscribedRes.rows) {
			const icId = row.id;
			await client.query(`UPDATE public.instance_courses SET allocation_status = 'Rejected' WHERE id = $1`, [icId]);

			await client.query(`UPDATE public.preferences SET allocation_status = 'Course Rejected', status = -1 WHERE instance_course_id = $1`, [icId]);

			// Shift down final_preference for other preferences of affected students
			await client.query(
				`UPDATE public.preferences p1
				 SET final_preference = p1.final_preference - 1
				 FROM public.preferences pr
				 WHERE pr.instance_course_id = $1
				   AND pr.usn = p1.usn
				   AND p1.instance_course_id != $1
				   AND p1.final_preference > pr.final_preference`,
				[icId]
			);
		}

		// 3) Determine maximum final preference remaining for this instance
		const maxPrefRes = await client.query(
			`SELECT MAX(p.final_preference) AS max_pref
			 FROM public.preferences p
			 JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			 WHERE ic.instance_id = $1`,
			[instanceId]
		);

		const maxPref = Number(maxPrefRes.rows[0].max_pref) || 0;

		// 4) Allocation rounds from preference 1..maxPref
		for (let pref = 1; pref <= maxPref; pref++) {
			// fetch pending courses for this preference
			const coursesRes = await client.query(
				`SELECT ic.id, ic.max_intake, COALESCE(ic.total_allocations,0) AS total_allocations
				 FROM public.instance_courses ic
				 WHERE ic.instance_id = $1
				   AND COALESCE(ic.allocation_status,'Pending') NOT IN ('Rejected','Allocated')`,
				[instanceId]
			);

			for (const course of coursesRes.rows) {
				const icId = course.id;
				const available = Math.max(0, Number(course.max_intake || 0) - Number(course.total_allocations || 0));
				if (available <= 0) {
					// mark allocated if no seats
					await client.query(`UPDATE public.instance_courses SET allocation_status = 'Allocated' WHERE id = $1`, [icId]);
					continue;
				}

				// count demand
				const demandRes = await client.query(
					`SELECT COUNT(*) AS cnt
					 FROM public.preferences p
					 WHERE p.instance_course_id = $1
					   AND p.final_preference = $2
					   AND p.status = 0`,
					[icId, pref]
				);

				const demand = Number(demandRes.rows[0].cnt) || 0;

				if (demand === 0) continue;

				if (demand <= available) {
					// allocate all
					await client.query(
						`UPDATE public.preferences SET status = $1, allocation_status = 'Allotted' WHERE instance_course_id = $2 AND final_preference = $1 AND status = 0`,
						[pref, icId]
					);

					// update total_allocations
					await client.query(
						`UPDATE public.instance_courses SET total_allocations = COALESCE(total_allocations,0) + $1 WHERE id = $2`,
						[demand, icId]
					);

					// mark allocated if full
					const totalRes = await client.query(`SELECT total_allocations, max_intake FROM public.instance_courses WHERE id = $1`, [icId]);
					const totalAlloc = Number(totalRes.rows[0].total_allocations || 0);
					const maxIntake = Number(totalRes.rows[0].max_intake || 0);
					if (totalAlloc >= maxIntake) {
						await client.query(`UPDATE public.instance_courses SET allocation_status = 'Allocated' WHERE id = $1`, [icId]);
						// mark remaining as seats filled
						await client.query(`UPDATE public.preferences SET status = -final_preference, allocation_status = 'Seats filled at higher preference' WHERE instance_course_id = $1 AND status = 0`, [icId]);
					}
				} else {
					// oversubscribed: allocate top students by grade desc (simplified median logic)
					const usnRes = await client.query(
						`SELECT p.usn
						 FROM public.preferences p
						 JOIN public.student_academic_records sar ON sar.usn = p.usn
						 JOIN public.instances i ON i.id = $3
						 WHERE p.instance_course_id = $1
						   AND p.final_preference = $2
						   AND p.status = 0
						   AND CAST(sar.semester AS INTEGER) = i.semester
						 ORDER BY NULLIF(REGEXP_REPLACE(COALESCE(sar.grade,''),'[^0-9.]','','g'),'')::NUMERIC DESC
						 LIMIT $4`,
						[icId, pref, instanceId, available]
					);

					const usns = usnRes.rows.map((r) => r.usn);
					if (usns.length > 0) {
						const placeholders = usns.map((_, i) => `$${i + 3}`).join(',');
						const params = [icId, pref, ...usns];
						// update selected students
						await client.query(
							`UPDATE public.preferences SET status = $2, allocation_status = 'Allotted' WHERE instance_course_id = $1 AND usn IN (${placeholders}) AND status = 0`,
							params
						);

						// increment total_allocations by number allocated
						await client.query(
							`UPDATE public.instance_courses SET total_allocations = COALESCE(total_allocations,0) + $1 WHERE id = $2`,
							[usns.length, icId]
						);

						// after selection, if full then mark remaining as seats filled
						const totalRes2 = await client.query(`SELECT total_allocations, max_intake FROM public.instance_courses WHERE id = $1`, [icId]);
						const totalAlloc2 = Number(totalRes2.rows[0].total_allocations || 0);
						const maxIntake2 = Number(totalRes2.rows[0].max_intake || 0);
						if (totalAlloc2 >= maxIntake2) {
							await client.query(`UPDATE public.instance_courses SET allocation_status = 'Allocated' WHERE id = $1`, [icId]);
							await client.query(`UPDATE public.preferences SET status = -final_preference, allocation_status = 'Seats filled at higher preference' WHERE instance_course_id = $1 AND status = 0`, [icId]);
						}
					}
				}
			}
		}

		await client.query('COMMIT');
		return { success: true };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function setFinalPreferencesByInstance(instanceId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query(
			`UPDATE public.preferences p
			 SET final_preference = p.preferred
			 FROM public.instance_courses ic
			 WHERE p.instance_course_id = ic.id
			   AND ic.instance_id = $1`,
			[instanceId]
		);
		await client.query('COMMIT');
		return { success: true };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function rejectUnderSubscribedCoursesByInstance(instanceId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const underSubscribedRes = await client.query(
			`SELECT ic.id AS instance_course_id, ic.coursecode, c.coursename
			 FROM public.instance_courses ic
			 JOIN public.courses c ON UPPER(c.coursecode) = UPPER(ic.coursecode)
			 LEFT JOIN (
				SELECT instance_course_id, COUNT(*) FILTER (WHERE preferred = 1) AS p1_count
				FROM public.preferences
				GROUP BY instance_course_id
			 ) pref ON pref.instance_course_id = ic.id
			 WHERE ic.instance_id = $1
			   AND COALESCE(pref.p1_count, 0) < COALESCE(ic.min_intake, 0)
			 ORDER BY c.coursename ASC, ic.coursecode ASC`,
			[instanceId]
		);

		for (const row of underSubscribedRes.rows) {
			const icId = row.instance_course_id;
			await client.query(`UPDATE public.instance_courses SET allocation_status = 'Rejected' WHERE id = $1`, [icId]);
			await client.query(
				`UPDATE public.preferences
				 SET allocation_status = 'Course Rejected', status = -1
				 WHERE instance_course_id = $1`,
				[icId]
			);
		}

		await client.query('COMMIT');
		return { rejectedCourses: underSubscribedRes.rows };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function upgradePreferencesByInstance(instanceId, rejectedCourseIds) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (const icId of rejectedCourseIds) {
			await client.query(
				`UPDATE public.preferences p1
				 SET final_preference = p1.final_preference - 1
				 FROM public.preferences pr
				 JOIN public.instance_courses ic ON ic.id = pr.instance_course_id
				 WHERE pr.instance_course_id = $1
				   AND ic.instance_id = $2
				   AND pr.usn = p1.usn
				   AND p1.instance_course_id != $1
				   AND p1.final_preference > pr.final_preference`,
				[icId, instanceId]
			);
		}

		await client.query('COMMIT');
		return { success: true };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function allocateByInstance(instanceId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const maxPrefRes = await client.query(
			`SELECT MAX(p.final_preference) AS max_pref
			 FROM public.preferences p
			 JOIN public.instance_courses ic ON ic.id = p.instance_course_id
			 WHERE ic.instance_id = $1`,
			[instanceId]
		);

		const maxPref = Number(maxPrefRes.rows[0].max_pref) || 0;

		for (let pref = 1; pref <= maxPref; pref++) {
			const coursesRes = await client.query(
				`SELECT ic.id, ic.max_intake, COALESCE(ic.total_allocations, 0) AS total_allocations
				 FROM public.instance_courses ic
				 WHERE ic.instance_id = $1
				   AND COALESCE(ic.allocation_status, 'Pending') NOT IN ('Rejected', 'Allocated')`,
				[instanceId]
			);

			for (const course of coursesRes.rows) {
				const icId = course.id;
				const available = Math.max(0, Number(course.max_intake || 0) - Number(course.total_allocations || 0));
				if (available <= 0) {
					await client.query(`UPDATE public.instance_courses SET allocation_status = 'Allocated' WHERE id = $1`, [icId]);
					continue;
				}

				const demandRes = await client.query(
					`SELECT COUNT(*) AS cnt
					 FROM public.preferences p
					 WHERE p.instance_course_id = $1
					   AND p.final_preference = $2
					   AND p.status = 0`,
					[icId, pref]
				);

				const demand = Number(demandRes.rows[0].cnt) || 0;
				if (demand === 0) continue;

				if (demand <= available) {
					await client.query(
						`UPDATE public.preferences
						 SET status = $1, allocation_status = 'Allotted'
						 WHERE instance_course_id = $2
						   AND final_preference = $1
						   AND status = 0`,
						[pref, icId]
					);

					await client.query(
						`UPDATE public.instance_courses
						 SET total_allocations = COALESCE(total_allocations, 0) + $1
						 WHERE id = $2`,
						[demand, icId]
					);
				} else {
					const usnRes = await client.query(
						`SELECT p.usn
						 FROM public.preferences p
						 JOIN public.student_academic_records sar ON sar.usn = p.usn
						 JOIN public.instances i ON i.id = $3
						 WHERE p.instance_course_id = $1
						   AND p.final_preference = $2
						   AND p.status = 0
						   AND CAST(sar.semester AS INTEGER) = i.semester
						 ORDER BY NULLIF(REGEXP_REPLACE(COALESCE(sar.grade, ''), '[^0-9.]', '', 'g'), '')::NUMERIC DESC
						 LIMIT $4`,
						[icId, pref, instanceId, available]
					);

					const usns = usnRes.rows.map((r) => r.usn);
					if (usns.length > 0) {
						const placeholders = usns.map((_, i) => `$${i + 3}`).join(',');
						const params = [icId, pref, ...usns];
						await client.query(
							`UPDATE public.preferences
							 SET status = $2, allocation_status = 'Allotted'
							 WHERE instance_course_id = $1
							   AND usn IN (${placeholders})
							   AND status = 0`,
							params
						);

						await client.query(
							`UPDATE public.instance_courses
							 SET total_allocations = COALESCE(total_allocations, 0) + $1
							 WHERE id = $2`,
							[usns.length, icId]
						);
					}
				}

				const totalRes = await client.query(`SELECT total_allocations, max_intake FROM public.instance_courses WHERE id = $1`, [icId]);
				const totalAlloc = Number(totalRes.rows[0].total_allocations || 0);
				const maxIntake = Number(totalRes.rows[0].max_intake || 0);
				if (totalAlloc >= maxIntake) {
					await client.query(`UPDATE public.instance_courses SET allocation_status = 'Allocated' WHERE id = $1`, [icId]);
					await client.query(
						`UPDATE public.preferences
						 SET status = -final_preference, allocation_status = 'Seats filled at higher preference'
						 WHERE instance_course_id = $1
						   AND status = 0`,
						[icId]
					);
				}
			}
		}

		await client.query('COMMIT');
		return { success: true };
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
,
	runAllocationByInstance,
	setFinalPreferencesByInstance,
	rejectUnderSubscribedCoursesByInstance,
	upgradePreferencesByInstance,
	allocateByInstance
};