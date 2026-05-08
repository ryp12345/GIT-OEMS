const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'oems'
});

const query = `
  SELECT * FROM public.preferences 
  WHERE usn='2GI23CS007' 
    AND instance_course_id in (
      SELECT id FROM instance_courses WHERE coursecode='22EC647'
    ) 
    AND final_preference=status
`;

pool.query(query, (err, res) => {
  if (err) {
    console.error('ERROR:', err.message);
  } else {
    console.log('Query result:');
    console.log(JSON.stringify(res.rows, null, 2));
    console.log(`Total rows: ${res.rowCount}`);
  }
  pool.end();
});
