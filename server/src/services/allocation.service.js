const pool = require('../config/db');

// Returns { allocated: [...], unallocated: [...], summary: [...] }
async function getAllocationsForDownload(instanceId) {
  const allocatedResult = await pool.query(
    `SELECT
      s.usn,
      s.uid,
      s.name,
      s.email,
      s.department_id,
      d.shortname AS department,
      ic.coursecode,
      c.coursename,
      p.preferred,
      p.final_preference,
      p.allocation_status
     FROM public.preferences p
     JOIN public.instance_courses ic ON ic.id = p.instance_course_id
     JOIN public.courses c ON UPPER(c.coursecode) = UPPER(ic.coursecode)
     JOIN public.students s ON UPPER(s.usn) = UPPER(p.usn)
     LEFT JOIN public.departments d ON d.deptid = s.department_id
     WHERE ic.instance_id = $1
       AND p.status = p.final_preference
       AND p.allocation_status = 'Allotted'
     ORDER BY s.usn ASC, p.final_preference ASC`,
    [instanceId]
  );

// Matches PHP getUnallocatedStudents: students who still have status=0 (pending) preferences
  const unallocatedResult = await pool.query(
    `SELECT DISTINCT s.name, s.usn, s.department_id, d.shortname AS department
     FROM public.preferences p
     JOIN public.instance_courses ic ON ic.id = p.instance_course_id
     JOIN public.students s ON UPPER(s.usn) = UPPER(p.usn)
     LEFT JOIN public.departments d ON d.deptid = s.department_id
     WHERE ic.instance_id = $1
       AND p.status = 0
     ORDER BY s.usn ASC`,
    [instanceId]
  );

  const allocated = allocatedResult.rows;
  const unallocated = unallocatedResult.rows;
  const summary = [
    ['Metric', 'Count'],
    ['Total Allocated Students', allocated.length],
    ['Total Unallocated Students', unallocated.length],
    ['Total Students', allocated.length + unallocated.length]
  ];

  return { allocated, unallocated, summary };
}

module.exports = {
  getAllocationsForDownload
};
