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

module.exports = { getPreferencesByUsn, insertPreferences };
