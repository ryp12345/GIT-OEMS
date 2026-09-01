const pool = require('../config/db');

async function getPreferencesByUsn(usn, instanceId) {
	const result = await pool.query(
		`SELECT p.id, p.instance_course_id, p.usn, p.preferred, p.final_preference, p.allocation_status, p.status
		 FROM public.preferences p
		 JOIN public.instance_courses ic ON ic.id = p.instance_course_id
		 WHERE p.usn = $1 AND ic.instance_id = $2
		 ORDER BY p.preferred ASC`,
		[usn, instanceId]
	);
	return result.rows;
}

async function getPreferenceSubmissionDetails(preferences) {
	const instanceCourseIds = preferences.map((pref) => Number(pref.instance_course_id));
	if (instanceCourseIds.length === 0) {
		return [];
	}

	const result = await pool.query(
		`SELECT
			ic.id AS instance_course_id,
			ic.coursecode,
			c.coursename,
			eg.group_name,
			p.preferred
		 FROM public.instance_courses ic
		 LEFT JOIN public.courses c ON UPPER(TRIM(c.coursecode)) = UPPER(TRIM(ic.coursecode))
		 LEFT JOIN public.elective_group eg ON eg.id = c.elective_group_id
		 JOIN jsonb_to_recordset($1::jsonb) AS p(instance_course_id integer, preferred integer)
		   ON p.instance_course_id = ic.id
		 WHERE ic.id = ANY($2::int[])
		 ORDER BY p.preferred ASC, ic.id ASC`,
		[JSON.stringify(instanceCourseIds.map((id, index) => ({ instance_course_id: id, preferred: Number(preferences[index]?.preferred || index + 1) }))), instanceCourseIds]
	);

	return result.rows;
}

async function insertPreferences(preferences) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		// Determine the instance_id from the first entry to scope the delete
		const firstId = preferences[0].instance_course_id;
		const usn = preferences[0].usn;

		await client.query(
			`DELETE FROM public.preferences
			 WHERE usn = $1
			   AND instance_course_id IN (
			       SELECT id FROM public.instance_courses
			       WHERE instance_id = (
			           SELECT instance_id FROM public.instance_courses WHERE id = $2
			       )
			   )`,
			[usn, firstId]
		);

		for (const pref of preferences) {
			await client.query(
				`INSERT INTO public.preferences
				    (instance_course_id, usn, preferred, final_preference, allocation_status, status)
				 VALUES ($1, $2, $3, $3, 'Pending', 0)`,
				[pref.instance_course_id, pref.usn, pref.preferred]
			);
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

module.exports = { getPreferencesByUsn, getPreferenceSubmissionDetails, insertPreferences };
