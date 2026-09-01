const pool = require('../config/db');
const instanceModel = require('../models/instance.model');

function formatGrade(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '';
  }

  return Number(value).toFixed(2);
}

function getFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function getPreferenceCellFromRow(row, pref) {
  return {
    count: getFirstDefined(row?.[`p${pref}_count`], row?.[`p${pref}_cnt`]),
    min_grade: getFirstDefined(row?.[`p${pref}_min_grade`], row?.[`p${pref}_min`]),
    median_grade: getFirstDefined(
      row?.[`p${pref}_median_grade`],
      row?.[`p${pref}_medium_grade`],
      row?.[`p${pref}_median`],
      row?.[`p${pref}_medium`]
    ),
    max_grade: getFirstDefined(row?.[`p${pref}_max_grade`], row?.[`p${pref}_max`])
  };
}

function getAllPreferences(rows) {
  const prefs = new Set();

  (rows || []).forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      const match = /^p(\d+)_count$/i.exec(key);
      if (match) {
        prefs.add(Number(match[1]));
      }
    });
  });

  if (prefs.size === 0) {
    return [1, 2];
  }

  return Array.from(prefs).filter(Number.isFinite).sort((a, b) => a - b);
}

function buildSummarySheet(rows, grandTotalAllocations) {
  const allPreferences = getAllPreferences(rows);
  const headerRow1 = ['Sl.No', 'Course Name'];
  const headerRow2 = ['', ''];

  allPreferences.forEach((pref) => {
    headerRow1.push(`Preference ${pref}`, '', '', '');
    headerRow2.push(String(pref), 'Min', 'Median', 'Max');
  });

  headerRow1.push('Div', 'Min', 'Max', 'Allocations');
  headerRow2.push('', '', '', '');

  const preferenceCountTotals = allPreferences.reduce((acc, pref) => {
    acc[pref] = (rows || []).reduce((sum, row) => {
      return sum + Number(getPreferenceCellFromRow(row, pref).count || 0);
    }, 0);
    return acc;
  }, {});

  const bodyRows = (rows || []).map((row, index) => {
    const rowCells = [index + 1, `${row.coursename || ''} (${row.coursecode || ''})`];

    allPreferences.forEach((pref) => {
      const preference = getPreferenceCellFromRow(row, pref);
      rowCells.push(
        preference.count ?? '',
        formatGrade(preference.min_grade),
        formatGrade(preference.median_grade),
        formatGrade(preference.max_grade)
      );
    });

    rowCells.push(
      row.division ?? '',
      row.min_intake ?? '',
      row.max_intake ?? '',
      row.total_allocations ?? ''
    );

    return rowCells;
  });

  const totalsRow = ['Column Totals', ''];
  allPreferences.forEach((pref) => {
    totalsRow.push(preferenceCountTotals[pref] ?? 0, '', '', '');
  });
  totalsRow.push('', '', '', grandTotalAllocations ?? 0);

  return [headerRow1, headerRow2, ...bodyRows, totalsRow];
}

// Returns { allocated: [...], unallocated: [...], preferenceNotGiven: [...], summary: [...] }
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

  // Students eligible in this instance, who submitted preferences, but received no allotment.
  const unallocatedResult = await pool.query(
    `WITH eligible_students AS (
       SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g')))
         s.usn,
         s.uid,
         s.name,
         s.email,
         s.department_id,
         d.shortname AS department,
         LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g')) AS usn_key
       FROM public.students s
       LEFT JOIN public.departments d ON d.deptid = s.department_id
       WHERE EXISTS (
         SELECT 1
         FROM public.student_academic_records sar
         WHERE sar.instance_id = $1
           AND LOWER(REGEXP_REPLACE(sar.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
       )
       ORDER BY LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g')), s.id DESC
     )
     SELECT
       es.name,
       es.usn,
       es.uid,
       es.email,
       es.department_id,
       es.department
     FROM eligible_students es
     WHERE EXISTS (
       SELECT 1
       FROM public.preferences p
       JOIN public.instance_courses ic ON ic.id = p.instance_course_id
       WHERE ic.instance_id = $1
         AND LOWER(REGEXP_REPLACE(p.usn, '\\s+', '', 'g')) = es.usn_key
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.preferences p
       JOIN public.instance_courses ic ON ic.id = p.instance_course_id
       WHERE ic.instance_id = $1
         AND LOWER(REGEXP_REPLACE(p.usn, '\\s+', '', 'g')) = es.usn_key
         AND p.allocation_status = 'Allotted'
     )
     ORDER BY es.usn ASC`,
    [instanceId]
  );

  // Students eligible in this instance (have SAR for this instance) but did not submit any preferences.
  const preferenceNotGivenResult = await pool.query(
    `WITH eligible_students AS (
       SELECT DISTINCT
         s.usn,
         s.uid,
         s.name,
         s.email,
         s.department_id,
         d.shortname AS department
       FROM public.students s
       LEFT JOIN public.departments d ON d.deptid = s.department_id
       WHERE EXISTS (
         SELECT 1
         FROM public.student_academic_records sar
         WHERE sar.instance_id = $1
           AND LOWER(REGEXP_REPLACE(sar.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(s.usn, '\\s+', '', 'g'))
       )
    )
    SELECT
      es.usn,
      es.uid,
      es.name,
      es.email,
      es.department_id,
      es.department
    FROM eligible_students es
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.preferences p
      JOIN public.instance_courses ic ON ic.id = p.instance_course_id
      WHERE ic.instance_id = $1
        AND LOWER(REGEXP_REPLACE(p.usn, '\\s+', '', 'g')) = LOWER(REGEXP_REPLACE(es.usn, '\\s+', '', 'g'))
    )
    ORDER BY es.usn ASC`,
    [instanceId]
  );

  const preferenceSummary = await instanceModel.getPreferenceStatisticsDetailsByInstance(instanceId);

  const allocated = allocatedResult.rows;
  const unallocated = unallocatedResult.rows;
  const preferenceNotGiven = preferenceNotGivenResult.rows;
  const summary = buildSummarySheet(
    preferenceSummary?.rows || [],
    preferenceSummary?.grandTotalAllocations || 0
  );

  return { allocated, unallocated, preferenceNotGiven, summary };
}

module.exports = {
  getAllocationsForDownload
};
