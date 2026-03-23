# Allocation.md

## Purpose of This Document

This document explains the **Allocation** feature of the Open Elective Management System (OEMS).  
It is written at two levels:
- **Part 1–2:** Plain-language explanation that anyone (including a high school student) can follow.
- **Part 3–9:** Technical detail for a developer implementing the same feature in the PERN stack.

The business logic described here is taken from the working PHP-MySQL implementation. The same database tables and schemas are used in the PERN stack. Where SQL is given, it works on both MySQL and PostgreSQL except where a note is present.

---

## Part 0 — Does Allocation Affect the Dashboard's "Student Preference Status"? (And Vice Versa)

### Short Answer

**Running Allocation does NOT change the "Student Preference Status" counts shown on the Dashboard. The Dashboard data mismatch between PHP-MySQL and PERN is independent of Allocation and is a pre-existing issue.**

### Detailed Explanation

The Dashboard widget "Student Preference Status" reads from the `preferences` table and counts:
- How many students (per department) have submitted at least one preference row for the selected instance.
- How many have not yet submitted.

The query counts rows by existence, like this (simplified):

```sql
COUNT(DISTINCT p.usn) AS students_with_preferences,
COUNT(DISTINCT s.usn) - COUNT(DISTINCT p.usn) AS students_without_preferences
```

The Allocation process **only updates existing rows** in `preferences` — it changes the `status`, `final_preference`, and `allocation_status` columns of rows that are already there.  
Allocation **never inserts new rows** and **never deletes rows** from `preferences`.

Therefore:
- Running Allocation → Dashboard "Student Preference Status" numbers stay exactly the same.
- Not running Allocation → Dashboard numbers stay exactly the same.
- Running Reset Allocation → `final_preference` is set back to 0 for all rows but rows still exist → Dashboard numbers stay the same.

**The mismatch you are seeing in the Dashboard is a bug in the PERN implementation of the `getPreferenceStatistics` query.** It is completely independent of whether Allocation has been run. Implementing Allocation will not fix or worsen that mismatch.

**Conversely**, the Dashboard data mismatch (wrong student-with-preferences count) does not affect Allocation because:
- Allocation uses the `preferred` and `final_preference` columns directly, not the Dashboard's count.
- Allocation reads CGPA from `student_academic_records`, not from the Dashboard widget.

**Conclusion:** You can safely implement Allocation without worrying about the Dashboard bug. The two features use separate queries and separate output columns.

---

## Part 1 — What Is Allocation? (Simple Language)

### Setting the Scene

Imagine your school offers 10 optional subjects (called electives) and each student must pick one of them for the semester.  
There are 500 students but each subject can only take 40–60 students.

Students fill in a form rank-ordering their preferences:
- "I want Subject A the most, Subject C second, Subject E third."

The school admin then runs **Allocation** — an automated process that decides which subject each student is assigned to.

---

### Key Players

| Thing | What It Is |
|---|---|
| **Elective Instance** | A single batch run, e.g., "Semester 7 Electives – 2025–26". Think of it as one exam season. |
| **Course (Elective Subject)** | One optional subject being offered, e.g., "Machine Learning". |
| **Instance Course** | That same subject as it appears in this specific instance, with its own seat limits. |
| **min_intake** | The minimum number of students needed to run this course. If too few students sign up, the course is cancelled. |
| **max_intake** | The maximum number of students allowed in this course. |
| **preferred** | The student's original, never-changing rank order they submitted. |
| **final_preference** | A working copy of the rank. Gets adjusted during allocation if some courses are cancelled. |
| **CGPA / grade** | The student's academic score (from `student_academic_records`). Used as a tie-breaker. |

---

### The Three-Phase Allocation Process (High-Level)

Think of Allocation as three buttons the admin clicks, one by one.

#### Phase 1 — "Start" (Prepare & Reject)

When the admin clicks **Start**:

1. The system makes a working copy of every student's choices (copies `preferred` → `final_preference`).
2. It looks at preference-1 demand for every course: "How many students listed this course as their first choice?"
3. If a course's first-choice demand is below its `min_intake`, that course **is cancelled (Rejected)**.
4. The admin is then shown a button: **Upgrade Preferences**.

**Why reject?** A course with only 2 students signed up is not worth running if it needs at least 20 students.

---

#### Phase 2 — "Upgrade Preferences" (Adjust After Rejections)

When the admin clicks **Upgrade Preferences**:

For each cancelled course:
1. All students who had that course in their list get its row marked as "Course Rejected" so it is skipped.
2. For the same students, any choice that was positioned **below** (i.e., worse priority than) the cancelled course moves up by one rank.

**Example:**

A student had:
- Rank 1 → "Machine Learning"
- Rank 2 → "Cloud Computing" ← THIS gets rejected
- Rank 3 → "Blockchain"
- Rank 4 → "AR/VR"

After upgrade:
- Rank 1 → "Machine Learning" (unchanged)
- Rank 2 → "Blockchain" (moved up from 3)
- Rank 3 → "AR/VR" (moved up from 4)
- "Cloud Computing" → Marked "Course Rejected", ignored going forward.

The admin is then shown a button: **Allocate**.

---

#### Phase 3 — "Allocate" (Assign Seats Round by Round)

When the admin clicks **Allocate**, the system runs through all preference rounds (1, 2, 3, … up to the maximum any student used).

In each round, for each eligible course:
1. **Calculate available seats** = max_intake − already-allocated seats.
2. If available seats = 0, skip this course (it's full).
3. If available seats > 0:
   - **Count demand**: how many unallocated students still have this course at this preference rank?
   - If demand ≤ available seats → **Simple Allocation**: give everyone what they want.
   - If demand > available seats → **Median Allocation**: use CGPA bands to fairly distribute the limited seats.

---

### Simple Allocation (when there's enough room)

All students who listed this course at rank N and haven't been placed yet → get placed in this course.  
Their row in the system is marked "Allotted" with the preference rank they got seats at.

---

### Median Allocation (when too many students want the same course)

This is the clever part. Imagine 80 students want Course X but there are only 30 seats available.

The system looks at the CGPA (grade) of those 80 students and finds:
- The lowest CGPA: **6.5**
- The median CGPA (middle value): **8.0**
- The highest CGPA: **9.5**

It then divides the grade range into **6 buckets**:

**Above-median buckets (from median upward):**
- Bucket A: 8.0 → 8.5
- Bucket B: 8.5 → 9.0
- Bucket C: 9.0 → 9.5 (up to the max)

**Below-median buckets (from min upward to median):**
- Bucket D: 6.5 → 7.0
- Bucket E: 7.0 → 7.5
- Bucket F: 7.5 → 8.0 (up to median)

It allocates **30 ÷ 6 = 5 seats per bucket**.

Inside each bucket, students with higher CGPA are picked first.  
If a bucket has fewer than 5 eligible students, the leftover quota is carried forward to the next bucket.

**Why buckets?** This method ensures that students across all CGPA ranges get a fair chance, instead of simply taking the top 30 by CGPA (which would systematically exclude lower-scoring students who still deserve a seat).

---

### What Happens to Students Who Didn't Get Placed in This Round?

- If all seats for a course were filled and they didn't get picked → they remain "Pending" and will be considered for their next choice in the next round.
- If a student's CGPA wasn't in any qualifying band during this round → marked "CGPA not in range". They are still eligible at their next-choice course in the next round.

---

### Status Codes Explained (Plain Language)

**For a course row (`instance_courses.allocation_status`):**

| Status | What It Means |
|---|---|
| `Pending` | Not fully decided yet. May have some seats filled, more rounds to go. |
| `Allocated` | Seats are fully filled. This course is complete. |
| `Rejected` | Too few first-choice students. Course cancelled before allocation started. |

**For a student's preference row (`preferences.status` and `preferences.allocation_status`):**

| `status` value | `allocation_status` | What It Means |
|---|---|---|
| `0` | `Pending` | Not yet placed. Still in the queue. |
| `1` / `2` / `3` … | `Allotted` | Placed in a course. The number shows which preference rank they got. |
| `-1` | `Course Rejected` | Their choice was rejected before allocation started. |
| negative number | `CGPA not in range` | Their CGPA was not picked in the band selection. |
| negative number | `Seats filled at higher preference` | Seats were already full when this row was considered. |

---

### Reset Allocation

If something goes wrong or the admin wants to start over:
- All `preferences` rows for the instance are reset: status back to 0, allocation_status back to `Pending`, final_preference back to 0.
- All `instance_courses` rows are reset: total_allocations back to 0, allocation_status back to `Pending`.
- The students' original `preferred` values are never touched. Only the working fields are reset.

---

### Download

After allocation is complete, the admin can download a CSV file listing:
- Student name
- Student USN (ID number)
- Course name
- Course code

Only students with `allocation_status = 'Allotted'` are included (students who got a seat).

---

## Part 2 — How This Connects to Other Features

| Feature | Relationship to Allocation |
|---|---|
| **Elective Instance** | Allocation operates on ONE selected instance at a time. The instance must exist before allocation can run. |
| **Courses** | The courses offered in an instance come from `instance_courses`. Seat limits (min/max) are set on `instance_courses`. |
| **Students** | Student CGPA is read from `student_academic_records`. Students are identified by `usn`. |
| **Elective Preferences** | The `preferences` table (filled when students submit their choices) is the INPUT to Allocation. The Reset button and Download button are on the Elective Preferences page. |
| **Dashboard** | Shows "Student Preference Status" (who submitted preferences). Allocation does NOT change this. |

---

## Part 3 — Database Tables and Fields Used by Allocation
Note: The db tables and data already exist in POSTGRE. I use PGAdmin tool.
So before is just an explanation. May not be very useful. Maybe some part of it is.
### Table: `instances`
| Column | Type | Role in Allocation |
|---|---|---|
| `id` | INT PK | Identifies which instance is being processed |
| `instancename` | VARCHAR | Display only |
| `semester` | INT | Used to join courses (courses are semester-specific) |
| `form_enabled` | BOOL | Not used by allocation. Used by Dashboard. |
| `status` | VARCHAR | Not used directly |

---

### Table: `instance_courses`
| Column | Type | Role in Allocation |
|---|---|---|
| `id` | INT PK | `instance_course_id` — the key identifier |
| `instance_id` | INT FK | Links to instances |
| `coursecode` | VARCHAR | Links to courses |
| `min_intake` | INT | **READ** in Phase 1 rejection check |
| `max_intake` | INT | **READ** in Phase 3 availability check |
| `total_allocations` | INT | **READ + WRITTEN** — counts allocated students |
| `allocation_status` | VARCHAR | **WRITTEN** — `Pending`, `Allocated`, `Rejected` |
| `division` | VARCHAR | Display only in statistics view |

---

### Table: `preferences`
| Column | Type | Role in Allocation |
|---|---|---|
| `id` | INT PK | Row ID |
| `usn` | VARCHAR | Student ID |
| `instance_course_id` | INT FK | Links to instance_courses |
| `preferred` | INT | **READ ONLY** — student's original submitted rank. NEVER modified by Allocation. |
| `final_preference` | INT | **WRITTEN** — working rank, adjusted if courses are rejected |
| `status` | INT | **WRITTEN** — 0=pending, positive=allotted rank, negative=rejected/not allocated |
| `allocation_status` | VARCHAR | **WRITTEN** — text description of outcome |

---

### Table: `courses`
| Column | Type | Role in Allocation |
|---|---|---|
| `coursecode` | VARCHAR PK | Joins to instance_courses |
| `coursename` | VARCHAR | Display |
| `semester` | INT | Used in joins to match student CGPA semester |

---

### Table: `students`
| Column | Type | Role in Allocation |
|---|---|---|
| `usn` | VARCHAR | JOIN key |
| `department_id` | INT | Not used in allocation logic itself |

---

### Table: `student_academic_records`
| Column | Type | Role in Allocation |
|---|---|---|
| `usn` | VARCHAR | JOIN key |
| `semester` | INT | Must match course semester for CGPA lookup |
| `grade` | DECIMAL | **READ** — CGPA used in median-based allocation |

---

### Table: `departments`
| Column | Type | Role in Allocation |
|---|---|---|
| `DeptID` | INT | Used only in display/statistics queries |
| `shortname` | VARCHAR | Used only in display/statistics queries |

---

## Part 4 — Complete Business Logic (Technology-Agnostic)

### Phase 1: Set Final Preferences and Reject Under-Subscribed Courses

**Trigger:** Admin selects an instance and clicks "Start".

#### Step 1.1 — Copy `preferred` to `final_preference`

For every `preferences` row that belongs to the selected instance, copy the student's original submitted rank into the working rank field.

```sql
UPDATE preferences
SET final_preference = preferred
WHERE instance_course_id IN (
    SELECT id FROM instance_courses WHERE instance_id = :instance_id
);
```

**Notes:**
- This runs on every "Start" request.
- It also re-runs at the start of the "Upgrade Preferences" and "Allocate" requests (because the PHP controller evaluates the first if-block for any request that includes `instance_id`).

#### Step 1.2 — Fetch Course Details for Preference Round 1

Retrieve all non-rejected, non-allocated courses for the instance along with how many students listed each as preference 1, and the min/max/median CGPA of those students.

```sql
WITH preference_grades AS (
    SELECT
        ic.id AS instance_course_id,
        ic.allocation_status,
        i.id AS instanceid,
        i.semester,
        c.coursecode,
        c.coursename,
        p.final_preference,
        ic.division,
        ic.min_intake,
        ic.max_intake,
        c.id AS coursesid,
        ic.total_allocations,
        sar.grade
    FROM preferences p
    JOIN instance_courses ic ON p.instance_course_id = ic.id
    JOIN instances i ON i.id = ic.instance_id
    JOIN courses c ON ic.coursecode = c.coursecode
    JOIN students s ON p.usn = s.usn
    JOIN student_academic_records sar ON s.usn = sar.usn AND sar.semester = c.semester
    WHERE
        i.id = :instance_id
        AND ic.allocation_status NOT IN ('Rejected', 'Allocated')
        AND p.status = 0
),
ranked_grades AS (
    SELECT
        instance_course_id,
        final_preference,
        grade,
        ROW_NUMBER() OVER (PARTITION BY instance_course_id, final_preference ORDER BY grade) AS rn_asc,
        COUNT(*) OVER (PARTITION BY instance_course_id, final_preference) AS cnt
    FROM preference_grades
),
medians AS (
    SELECT
        instance_course_id,
        final_preference,
        AVG(grade) AS median_grade
    FROM (
        SELECT instance_course_id, final_preference, grade, cnt, rn_asc
        FROM ranked_grades
        WHERE rn_asc = (cnt + 1) / 2
           OR rn_asc = cnt / 2
    ) t
    GROUP BY instance_course_id, final_preference
),
aggregates AS (
    SELECT
        instance_course_id,
        final_preference,
        COUNT(*) AS count_pref,
        MAX(grade) AS max_grade,
        MIN(grade) AS min_grade
    FROM preference_grades
    GROUP BY instance_course_id, final_preference
)
SELECT
    pg.coursecode,
    pg.instanceid,
    pg.allocation_status,
    pg.coursename,
    pg.instance_course_id,
    pg.max_intake,
    pg.min_intake,
    pg.division,
    pg.coursesid,
    pg.semester,
    pg.total_allocations,
    COALESCE(a.count_pref, 0) AS p_count,
    a.max_grade AS p_max_grade,
    a.min_grade AS p_min_grade,
    m.median_grade AS p_median_grade
FROM (
    SELECT DISTINCT
        instance_course_id, coursecode, coursename, instanceid,
        max_intake, allocation_status, semester, min_intake,
        total_allocations, division, coursesid
    FROM preference_grades
) pg
LEFT JOIN aggregates a ON a.instance_course_id = pg.instance_course_id AND a.final_preference = :preference_no
LEFT JOIN medians m ON m.instance_course_id = pg.instance_course_id AND m.final_preference = :preference_no
WHERE pg.instance_course_id IN (
    SELECT ic.id FROM instance_courses ic WHERE ic.instance_id = :instance_id
)
ORDER BY pg.instance_course_id;
```

**PostgreSQL note:** The integer division in `(cnt + 1) / 2` and `cnt / 2` behaves identically in PostgreSQL because both are integers. For the median to be correct for even counts in PostgreSQL, use `(cnt + 1) / 2` which returns the lower-middle row. The result is mathematically equivalent to MySQL's float-based comparison for this use case.

**Parameters:** `:instance_id`, `:preference_no` (pass `1` for Phase 1 rejection check, and the loop counter during Phase 3)

**Returns:** One row per eligible course with `p_count`, `p_min_grade`, `p_median_grade`, `p_max_grade` for the requested preference number.

#### Step 1.3 — Reject Under-Subscribed Courses

For each course returned above: if `min_intake > p_count`, reject that course.

```sql
UPDATE instance_courses
SET allocation_status = 'Rejected'
WHERE id = :instance_course_id;
```

**Note:** Collect the `instance_course_id` of every rejected course into an array. You will need this array in Phase 2.

**Result shown to admin:** "Rejected: [coursecode]" for each rejection. Button "Upgrade Preferences" is shown.

---

### Phase 2: Upgrade Student Preferences for Rejected Courses

**Trigger:** Admin clicks "Upgrade Preferences".

**Note:** Phase 1 Steps 1.1–1.3 re-run first (because `instance_id` is present in the request), so the `rejectedcourses` array is rebuilt. This means previously rejected courses are collected again and re-processed.

For each `rejected_course_id` in the array:

#### Step 2.1 — Mark Preferences for the Rejected Course

```sql
UPDATE preferences
SET allocation_status = 'Course Rejected',
    status = -1
WHERE instance_course_id = :instance_course_id;
```

#### Step 2.2 — Shift Lower Choices Up by One Rank

For every student who had the rejected course in their list: any other preference row whose `final_preference` rank is HIGHER (numerically greater, meaning a less-preferred choice) than the rank they gave to the rejected course gets decremented by 1.

```sql
UPDATE preferences AS p1
SET final_preference = final_preference - 1
WHERE final_preference > (
    SELECT final_preference
    FROM preferences AS p2
    WHERE p2.instance_course_id = :instance_course_id
      AND p2.usn = p1.usn
)
AND p1.instance_course_id != :instance_course_id;
```

**Result:** The admin sees "Preferences are Upgraded Successfully". Button "Allocate" is shown.

---

### Phase 3: Round-by-Round Seat Allocation

**Trigger:** Admin clicks "Allocate".

**Note:** Phase 1 Steps 1.1–1.3 re-run again here before allocation begins.

#### Step 3.1 — Get Maximum Preference Number Used

```sql
SELECT MAX(p.final_preference) AS max_preference
FROM preferences p
WHERE p.instance_course_id IN (
    SELECT id FROM instance_courses WHERE instance_id = :instance_id
);
```

**Returns:** A single integer (e.g., 5 if students used up to 5 choices).

#### Step 3.2 — Loop from Round 1 to max_preference

For each round `i` from 1 to max_preference:

1. Call the `getCourseDetailsByPreference` query (same as Section 4 Step 1.2) with `:preference_no = i`.
2. For each course returned:
   - Compute `availability = max_intake - total_allocations`.
   - If `availability <= 0`: skip — course is full.
   - If `availability > 0`:
     - If `p_count > availability`: use **Median-Based Allocation** (Step 3.3).
     - Else (`p_count <= availability`): use **Simple Allocation** (Step 3.4).

---

#### Step 3.3 — Simple Allocation (demand ≤ supply)

Called when `p_count <= availability`.

**Step 3.3.1 — Allocate all pending students with this preference for this course (instance-wide update):**

```sql
UPDATE preferences
SET status = :preference_no,
    allocation_status = 'Allotted'
WHERE status = 0
  AND usn IN (
      SELECT usn
      FROM preferences
      WHERE status = 0
        AND instance_course_id = :instance_course_id
        AND final_preference = :preference_no
  )
  AND instance_course_id IN (
      SELECT id FROM instance_courses WHERE instance_id = :instance_id
  );
```

**Note:** The outer WHERE clause updates across all courses in the instance for the matching USNs; multiple pending rows for the same student may be updated together.

**Step 3.3.2 — Count how many students are now allocated to this course:**

```sql
SELECT COUNT(*) AS cnt
FROM preferences
WHERE status = final_preference
  AND instance_course_id = :instance_course_id;
```

Assign the result to `students_allocated`.

**Step 3.3.3 — If course is now full, mark overflow rows:**

If `max_intake - students_allocated <= 0`:

```sql
UPDATE preferences
SET status = -final_preference,
    allocation_status = 'Seats filled at higher preference'
WHERE instance_course_id = :instance_course_id
  AND status = 0
  AND final_preference > :preference_no;
```

**Step 3.3.4 — Update the course row:**

```sql
UPDATE instance_courses
SET total_allocations = :students_allocated,
    allocation_status = :allocation_status
WHERE id = :instance_course_id;
```

Where `:allocation_status` is `'Allocated'` if `max_intake - students_allocated <= 0`, else `'Pending'`.

**Note:** The simple path writes the **absolute counted value** to `total_allocations` (not an increment).

---

#### Step 3.4 — Median-Based Allocation (demand > supply)

Called when `p_count > availability`.

**Inputs available per course:** `p_min_grade`, `p_median_grade`, `p_max_grade`, `availability`, `instance_course_id`, `semester`, `preference_no`.

**Step 3.4.1 — Compute step sizes:**

```
stepper_above = (p_max_grade - p_median_grade) / 3
stepper_below = (p_median_grade - p_min_grade) / 3
seats_per_bucket = ROUND(availability / 6)
```

**Step 3.4.2 — Allocate ABOVE the median (3 buckets, from median upward):**

Start with `r = p_median_grade`. Loop while `(p_max_grade - r) > 0.001`:

- `upper = r + stepper_above`
- If `upper` is within 0.1 of `p_max_grade`, snap it to `p_max_grade` exactly.
- Select up to `count_to_allocate` students in the range `[r, upper)`:

```sql
SELECT p.usn
FROM preferences p
JOIN student_academic_records sar ON sar.usn = p.usn
WHERE final_preference = :preference_no
  AND instance_course_id = :instance_course_id
  AND semester = :semester
  AND grade >= :min_grade
  AND grade < :max_grade
  AND p.status = 0
ORDER BY grade DESC
LIMIT :count_to_allocate;
```

- If any USNs are returned, update them (instance-wide update for USNs, same logic as Step 3.3.1 above):

```sql
UPDATE preferences
SET status = :preference_no,
    allocation_status = 'Allotted'
WHERE status = 0
  AND usn IN ( /* list of USNs */ )
  AND instance_course_id IN (
      SELECT id FROM instance_courses WHERE instance_id = :instance_id
  );
```

- Add count of allocated students to `students_allocated`.
- **Carry-forward logic:** If `students_allocated < bucket_index * seats_per_bucket`, increase `count_to_allocate` for the next bucket by the deficit.
- Advance `r = upper`. Increment bucket index.

**Step 3.4.3 — Allocate BELOW the median (3 buckets, from min upward):**

Start with `r = p_min_grade`. Loop while `(p_median_grade - r) > 0.001`:

- Same structure as above but using `stepper_below` and traversing upward from min to median.
- Same SELECT and UPDATE queries.

**Step 3.4.4 — Mark unallocated students in this course:**

```sql
UPDATE preferences
SET status = -final_preference,
    allocation_status = CASE
        WHEN final_preference = :preference_no THEN 'CGPA not in range'
        WHEN final_preference > :preference_no AND status = 0
             THEN 'Seats filled at higher preference'
    END
WHERE instance_course_id = :instance_course_id
  AND status = 0;
```

**Step 3.4.5 — Update the course row (increment, not absolute):**

```sql
UPDATE instance_courses
SET total_allocations = total_allocations + :newly_allocated,
    allocation_status = :allocation_status
WHERE id = :instance_course_id;
```

Where `:allocation_status` is:
- `'Allocated'` if `total_allocations + newly_allocated >= max_intake`
- `'Pending'` otherwise

**Note:** The median path uses `total_allocations + increment` (adds to existing value). The simple path writes an absolute count.

---

### Phase 4: Reset Allocation

**Trigger:** Admin clicks "Reset Allocations" on the Elective Preferences page (with confirmation).

**Step 4.1 — Reset all preference rows for the instance:**

```sql
UPDATE preferences
SET allocation_status = 'Pending',
    status = 0,
    final_preference = 0
WHERE instance_course_id IN (
    SELECT id FROM instance_courses WHERE instance_id = :instance_id
);
```

**Step 4.2 — Reset all instance_course rows:**

```sql
UPDATE instance_courses
SET total_allocations = 0,
    allocation_status = 'Pending'
WHERE instance_id = :instance_id;
```

**Note:** The `preferred` column in `preferences` is never touched during reset (or anywhere in Allocation). It is the student's permanent original submission.

---

### Phase 5: Download Allocation Results

**Trigger:** Admin clicks "Download" on the Elective Preferences page.

```sql
SELECT
    students.name,
    students.usn,
    courses.coursename,
    courses.coursecode
FROM preferences
JOIN instance_courses ON instance_courses.id = preferences.instance_course_id
JOIN students ON students.usn = preferences.usn
JOIN courses ON instance_courses.coursecode = courses.coursecode
JOIN instances ON instances.id = instance_courses.instance_id
WHERE preferences.status = preferences.final_preference
  AND preferences.allocation_status = 'Allotted'
  AND instances.id = :instance_id
ORDER BY students.usn, students.department_id;
```

**Returns:** One row per student who was allocated. Exported as CSV.

---

### Phase 6: Statistics Display (Elective Preferences Page / Allocation Result View)

After allocation, the admin views results on the Elective Preferences page. The table was described in the UI section and uses this query:

```sql
WITH preference_grades AS (
    SELECT
        ic.id AS instance_course_id,
        ic.allocation_status,
        i.id AS instanceid,
        i.semester,
        c.coursecode,
        c.coursename,
        p.preferred,
        ic.division,
        ic.min_intake,
        ic.max_intake,
        c.id AS coursesid,
        ic.total_allocations,
        sar.grade
    FROM preferences p
    JOIN instance_courses ic ON p.instance_course_id = ic.id
    JOIN instances i ON i.id = ic.instance_id
    JOIN courses c ON ic.coursecode = c.coursecode
    JOIN students s ON p.usn = s.usn
    JOIN student_academic_records sar ON s.usn = sar.usn AND sar.semester = c.semester
    WHERE i.id = :instance_id
),
ranked_grades AS (
    SELECT
        instance_course_id,
        preferred,
        grade,
        ROW_NUMBER() OVER (PARTITION BY instance_course_id, preferred ORDER BY grade) AS ran_asc,
        COUNT(*) OVER (PARTITION BY instance_course_id, preferred) AS cnt
    FROM preference_grades
),
medians AS (
    SELECT
        instance_course_id,
        preferred,
        AVG(grade) AS median_grade
    FROM (
        SELECT instance_course_id, preferred, grade, cnt, ran_asc
        FROM ranked_grades
        WHERE ran_asc = (cnt + 1) / 2
           OR ran_asc = cnt / 2
    ) t
    GROUP BY instance_course_id, preferred
),
aggregates AS (
    SELECT
        instance_course_id,
        preferred,
        COUNT(*) AS count_pref,
        MAX(grade) AS max_grade,
        MIN(grade) AS min_grade
    FROM preference_grades
    GROUP BY instance_course_id, preferred
)
SELECT
    pg.coursecode,
    pg.instanceid,
    pg.allocation_status,
    pg.coursename,
    pg.instance_course_id,
    pg.max_intake,
    pg.min_intake,
    pg.division,
    pg.coursesid,
    pg.semester,
    pg.total_allocations,

    -- Preference 1 stats
    COALESCE(a1.count_pref, 0)   AS p1_count,
    a1.max_grade                  AS p1_max_grade,
    a1.min_grade                  AS p1_min_grade,
    m1.median_grade               AS p1_median_grade,

    -- Preference 2 stats
    COALESCE(a2.count_pref, 0)   AS p2_count,
    a2.max_grade                  AS p2_max_grade,
    a2.min_grade                  AS p2_min_grade,
    m2.median_grade               AS p2_median_grade,

    -- Preference 3 stats
    COALESCE(a3.count_pref, 0)   AS p3_count,
    a3.max_grade                  AS p3_max_grade,
    a3.min_grade                  AS p3_min_grade,
    m3.median_grade               AS p3_median_grade,

    -- Preference 4 stats
    COALESCE(a4.count_pref, 0)   AS p4_count,
    a4.max_grade                  AS p4_max_grade,
    a4.min_grade                  AS p4_min_grade,
    m4.median_grade               AS p4_median_grade,

    -- Preference 5 stats
    COALESCE(a5.count_pref, 0)   AS p5_count,
    a5.max_grade                  AS p5_max_grade,
    a5.min_grade                  AS p5_min_grade,
    m5.median_grade               AS p5_median_grade

FROM (
    SELECT DISTINCT instance_course_id, coursecode, coursename, instanceid,
           max_intake, allocation_status, semester, min_intake,
           total_allocations, division, coursesid
    FROM preference_grades
) pg
LEFT JOIN aggregates a1 ON a1.instance_course_id = pg.instance_course_id AND a1.preferred = 1
LEFT JOIN medians m1   ON m1.instance_course_id = pg.instance_course_id AND m1.preferred = 1
LEFT JOIN aggregates a2 ON a2.instance_course_id = pg.instance_course_id AND a2.preferred = 2
LEFT JOIN medians m2   ON m2.instance_course_id = pg.instance_course_id AND m2.preferred = 2
LEFT JOIN aggregates a3 ON a3.instance_course_id = pg.instance_course_id AND a3.preferred = 3
LEFT JOIN medians m3   ON m3.instance_course_id = pg.instance_course_id AND m3.preferred = 3
LEFT JOIN aggregates a4 ON a4.instance_course_id = pg.instance_course_id AND a4.preferred = 4
LEFT JOIN medians m4   ON m4.instance_course_id = pg.instance_course_id AND m4.preferred = 4
LEFT JOIN aggregates a5 ON a5.instance_course_id = pg.instance_course_id AND a5.preferred = 5
LEFT JOIN medians m5   ON m5.instance_course_id = pg.instance_course_id AND m5.preferred = 5

ORDER BY pg.instance_course_id;
```

---

## Part 5 — UI Walkthrough

### 5a. Allocation Page (`admin/allocation.php` → `Allocation.jsx`)

This is the **main Allocation page** accessible from the sidebar menu item "Allocation".

#### Page Header
- Title: **Allocation**
- Subtitle: "Open Elective Management System."

#### Form: Choose Elective Instance (always visible)

| Element | Details |
|---|---|
| Section title | "Choose Elective Instance" |
| `<select>` | `id="instance_id"`, `name="instance_id"`, required. Populated with all instances from the `instances` table. Default option value `#` with text "Select Elective Instances". |
| Submit button | `value="Start"`, no specific `name` attribute needed beyond triggering the form. In PHP it uses `name="Submit"`. |

**What happens after "Start" is clicked:**
- A result area below the form renders new content (the next form in the workflow).

#### Dynamic Area: After "Start" (Phase 1 output)

The `$result` variable is rendered in the box body beneath the form. It contains the next action:

| Element | Details |
|---|---|
| Heading | "Upgrading the students preferences" (warning color) |
| Hidden field | `name="instance_id"`, value = selected instance id |
| Button | `name="update_preference"`, `value="Upgrade Preferences"` (warning/yellow style) |

If any courses were rejected, their course codes are also listed as text.

#### Dynamic Area: After "Upgrade Preferences" (Phase 2 output)

| Element | Details |
|---|---|
| Heading | "Preferences are Upgraded Successfully" (success/green color) |
| Hidden field | `name="instance_id"`, value = selected instance id |
| Button | `name="allocate"`, `value="Allocate"` (primary/blue style) |

#### Dynamic Area: After "Allocate" (Phase 3 output)

In the PHP implementation, there is no dedicated success message rendered after allocation. The `$result` string remains from any earlier phase or is empty. The allocation results are **viewed on the Elective Preferences page**, not on this page.

---

### 5b. Elective Preferences Page (Reset Allocations and Download)

This page (`elective_preferences.php` → `ElectivePreference.jsx`) contains both the Reset and Download buttons that are part of the Allocation workflow.

#### Form Header Area

| Element | Details |
|---|---|
| Section title | "Student Preference List" |
| Form action | Posts to `reset_allocations.php` (in PERN: to the `/api/allocation/reset` endpoint) |
| Instance selector | `id="insta_id"`, `name="instance_id"`. Default option `#`. Options from `instances` table. |
| Reset button | `id="reset_alloc_btn"`, `type="submit"`, `name="reset_allocations"`. **Hidden by default.** Shown when selected instance is not `#`. Has confirmation prompt: "Are you sure you want to reset all allocations? This action cannot be undone." |
| Download button | `id="download"`, `type="button"` (not submit). **Hidden by default.** Shown when selected instance is not `#`. On click, programmatically builds a POST request to `download.php` with the selected `instance_id` and triggers file download. |

#### Statistics Table (shown after instance selection, loaded dynamically)

**Table headers:**

| # | Course Name (Code) | P1 Count | P1 Min Grade | P1 Median Grade | P1 Max Grade | P2 Count | P2 Min | P2 Median | P2 Max | Division | Min Intake | Max Intake | Total Allocations | Allocation Status | View Statistics |

Each row has a background color based on `allocation_status`:
- **Red (`bg-danger`)** = Rejected
- **Green (`bg-success`)** = Allocated
- **Gray (`bg-gray`)** = Pending

The last column "View Statistics" shows a button (eye icon) only if `total_allocations > 0`. The button opens a modal containing a bar chart. The chart data is embedded in the row as `data-labels` and `data-chart` attributes.

**Grand Total row** at the bottom shows the sum of all `total_allocations`.

---

## Part 6 — PERN Stack Implementation Guide

This section provides step-by-step instructions to implement the Allocation feature in the PERN stack. Most of the UI in `Allocation.jsx` is already scaffolded. The backend files need to be created from scratch.

**Implementation order:**  
1. Backend route → controller → service (no frontend work yet)  
2. Test each API endpoint individually  
3. Implement the frontend page  
4. Test end-to-end  

---

### Step 1: Create the Backend Route File

**File location:** `server/src/routes/allocation.routes.js`  
**Action:** Create this new file.

This file defines all API endpoints for the Allocation feature.

```
Endpoints to define:

POST /api/allocation/statistics          → Get course statistics table for an instance
POST /api/allocation/start               → Phase 1: set final prefs + reject courses
POST /api/allocation/upgrade-preferences → Phase 2: upgrade preferences after rejection
POST /api/allocation/allocate            → Phase 3: run full allocation
POST /api/allocation/reset               → Reset all allocations for an instance
POST /api/allocation/download            → Get list of allotted students (for CSV export)
```

All routes are `POST` because they carry `instance_id` in the request body.

Register this file in `server/src/app.js` by adding:

```javascript
const allocationRoutes = require('./routes/allocation.routes');
app.use('/api/allocation', allocationRoutes);
```

Add this line alongside the other route registrations in `app.js`.

---

### Step 2: Create the Backend Controller File

**File location:** `server/src/controllers/allocation.controller.js`  
**Action:** Create this new file.

The controller validates incoming request bodies and calls the corresponding service functions. It does NOT contain SQL.

**Controller functions to implement:**

#### 2.1 — `getStatistics`
- Request body: `{ instance_id }`
- Validates `instance_id` is present and is a valid integer.
- Calls `allocationService.getPreferenceStatisticsDetails(instance_id)`.
- Returns 200 with the result array, or 400/500 on error.

#### 2.2 — `startAllocation`
- Request body: `{ instance_id }`
- Validates `instance_id`.
- Calls `allocationService.startAllocation(instance_id)`.
- Returns 200 with `{ rejectedCourses: [...], message: '...' }`.

#### 2.3 — `upgradePreferences`
- Request body: `{ instance_id }`
- Validates `instance_id`.
- Calls `allocationService.upgradePreferences(instance_id)`.
- Returns 200 with `{ message: 'Preferences upgraded successfully' }`.

#### 2.4 — `runAllocate`
- Request body: `{ instance_id }`
- Validates `instance_id`.
- Calls `allocationService.runAllocate(instance_id)`.
- Returns 200 with `{ message: 'Allocation complete' }`.

#### 2.5 — `resetAllocation`
- Request body: `{ instance_id }`
- Validates `instance_id`.
- Calls `allocationService.resetAllocation(instance_id)`.
- Returns 200 with `{ message: 'Allocations reset successfully' }`.

#### 2.6 — `downloadAllocation`
- Request body: `{ instance_id }`
- Validates `instance_id`.
- Calls `allocationService.getStudentsAllocationAll(instance_id)`.
- Returns 200 with the array of `{ name, usn, coursename, coursecode }`.
 - Returns 200 with the array of `{ name, usn, coursename, coursecode }`.

---

### Step 3: Create the Backend Service File

**File location:** `server/src/services/allocation.service.js`  
**Action:** Create this new file.

The service contains all SQL queries and business logic. Import the database connection from `server/src/config/db.js` (already exists).

---

#### 3.1 — `setFinalPreferences(instance_id)`

```javascript
async function setFinalPreferences(instance_id) {
  const query = `
    UPDATE preferences
    SET final_preference = preferred
    WHERE instance_course_id IN (
        SELECT id FROM instance_courses WHERE instance_id = $1
    )
  `;
  await pool.query(query, [instance_id]);
}
```

---

#### 3.2 — `getCourseDetailsByPreference(instance_id, preference_no)`

Use the large CTE query from Part 4 Step 1.2 above.  
Replace `:instance_id` with `$1` and `:preference_no` with `$2`.  
Return `result.rows`.

---

#### 3.3 — `rejectCourses(instance_course_id)`

```javascript
async function rejectCourses(instance_course_id) {
  const query = `
    UPDATE instance_courses
    SET allocation_status = 'Rejected'
    WHERE id = $1
  `;
  await pool.query(query, [instance_course_id]);
}
```

---

#### 3.4 — `startAllocation(instance_id)` (orchestrator for Phase 1)

```javascript
async function startAllocation(instance_id) {
  // Step 1: copy preferred → final_preference
  await setFinalPreferences(instance_id);

  // Step 2: get courses with preference-1 demand
  const courses = await getCourseDetailsByPreference(instance_id, 1);

  // Step 3: reject under-subscribed courses
  const rejectedCourses = [];
  for (const course of courses) {
    if (course.min_intake > course.p_count) {
      await rejectCourses(course.instance_course_id);
      rejectedCourses.push(course.instance_course_id);
    }
  }

  return { rejectedCourses, message: `Rejected ${rejectedCourses.length} course(s)` };
}
```

---

#### 3.5 — `upgradeStudentsPreferences(rejected_course_id)`

```javascript
async function upgradeStudentsPreferences(rejected_course_id) {
  // Step 1: mark rejected-course preference rows
  const markQuery = `
    UPDATE preferences
    SET allocation_status = 'Course Rejected',
        status = -1
    WHERE instance_course_id = $1
  `;
  await pool.query(markQuery, [rejected_course_id]);

  // Step 2: shift down ranks of other courses (for same student)
  const shiftQuery = `
    UPDATE preferences AS p1
    SET final_preference = final_preference - 1
    WHERE final_preference > (
        SELECT final_preference
        FROM preferences AS p2
        WHERE p2.instance_course_id = $1
          AND p2.usn = p1.usn
    )
    AND p1.instance_course_id != $1
  `;
  await pool.query(shiftQuery, [rejected_course_id]);
}
```

---

#### 3.6 — `upgradePreferences(instance_id)` (orchestrator for Phase 2)

```javascript
async function upgradePreferences(instance_id) {
  // Re-run Phase 1 to get rejected course IDs (mirrors PHP behavior)
  await setFinalPreferences(instance_id);
  const courses = await getCourseDetailsByPreference(instance_id, 1);

  const rejectedCourses = [];
  for (const course of courses) {
    if (course.min_intake > course.p_count) {
      await rejectCourses(course.instance_course_id);
      rejectedCourses.push(course.instance_course_id);
    }
  }

  // Now upgrade preferences for all rejected courses
  for (const rejCourseId of rejectedCourses) {
    await upgradeStudentsPreferences(rejCourseId);
  }

  return { message: 'Preferences upgraded successfully' };
}
```

---

#### 3.7 — `getMaxPreference(instance_id)`

```javascript
async function getMaxPreference(instance_id) {
  const query = `
    SELECT MAX(p.final_preference) AS max_preference
    FROM preferences p
    WHERE p.instance_course_id IN (
        SELECT id FROM instance_courses WHERE instance_id = $1
    )
  `;
  const result = await pool.query(query, [instance_id]);
  return parseInt(result.rows[0].max_preference) || 1;
}
```

---

#### 3.8 — `allocateStudents(course, preference_no, availability, instance_id)`

```javascript
async function allocateStudents(course, preference_no, availability, instance_id) {
  const instance_course_id = course.instance_course_id;

  // Step 1: allocate all matching pending students (instance-wide update)
  const allocQuery = `
    UPDATE preferences
    SET status = $1,
        allocation_status = 'Allotted'
    WHERE status = 0
      AND usn IN (
          SELECT usn FROM preferences
          WHERE status = 0
            AND instance_course_id = $2
            AND final_preference = $1
      )
      AND instance_course_id IN (
          SELECT id FROM instance_courses WHERE instance_id = $3
      )
  `;
  await pool.query(allocQuery, [preference_no, instance_course_id, instance_id]);

  // Step 2: count total allocated rows for this course
  const countQuery = `
    SELECT COUNT(*) AS cnt
    FROM preferences
    WHERE status = final_preference
      AND instance_course_id = $1
  `;
  const countResult = await pool.query(countQuery, [instance_course_id]);
  const students_allocated = parseInt(countResult.rows[0].cnt);

  // Step 3: if course is full, mark overflow rows
  let allocation_status = 'Pending';
  if (course.max_intake - students_allocated <= 0) {
    allocation_status = 'Allocated';
    const overflowQuery = `
      UPDATE preferences
      SET status = -final_preference,
          allocation_status = 'Seats filled at higher preference'
      WHERE instance_course_id = $1
        AND status = 0
        AND final_preference > $2
    `;
    await pool.query(overflowQuery, [instance_course_id, preference_no]);
  }

  // Step 4: update instance_courses (ABSOLUTE value)
  const updateCourseQuery = `
    UPDATE instance_courses
    SET total_allocations = $1,
        allocation_status = $2
    WHERE id = $3
  `;
  await pool.query(updateCourseQuery, [students_allocated, allocation_status, instance_course_id]);

  return students_allocated;
}
```

---

#### 3.9 — `allocateStudentsUsingMedian(course, preference_no, available_seats, instance_id)`

```javascript
async function allocateStudentsUsingMedian(course, preference_no, available_seats, instance_id) {
  const instance_course_id = course.instance_course_id;
  const max_cgpa = parseFloat(course.p_max_grade);
  const min_cgpa = parseFloat(course.p_min_grade);
  const median_cgpa = parseFloat(course.p_median_grade);
  const stepper_above = (max_cgpa - median_cgpa) / 3;
  const stepper_below = (median_cgpa - min_cgpa) / 3;
  const seats_per_bucket = Math.round(available_seats / 6);
  const epsilon = 0.001;

  let students_allocated = 0;
  let count_to_allocate = seats_per_bucket;
  const semester = course.semester;

  // Helper: select USNs in a grade range and allocate them
  async function allocateBucket(lower, upper, bucket_index) {
    const selectQuery = `
      SELECT p.usn
      FROM preferences p
      JOIN student_academic_records sar ON sar.usn = p.usn
      WHERE final_preference = $1
        AND instance_course_id = $2
        AND sar.semester = $3
        AND sar.grade >= $4
        AND sar.grade < $5
        AND p.status = 0
      ORDER BY sar.grade DESC
      LIMIT $6
    `;
    const selectResult = await pool.query(selectQuery, [
      preference_no, instance_course_id, semester,
      lower, upper, count_to_allocate
    ]);
    const usns = selectResult.rows.map(r => r.usn);

    if (usns.length > 0) {
      // Build parameterized placeholders for IN clause
      const placeholders = usns.map((_, i) => `$${i + 2}`).join(', ');
      const updateQuery = `
        UPDATE preferences
        SET status = $1,
            allocation_status = 'Allotted'
        WHERE status = 0
          AND usn IN (${placeholders})
          AND instance_course_id IN (
              SELECT id FROM instance_courses WHERE instance_id = $${usns.length + 2}
          )
      `;
      await pool.query(updateQuery, [preference_no, ...usns, instance_id]);
      students_allocated += usns.length;
    }

    // Carry-forward: if under-filled, increase next bucket's quota
    if (students_allocated < bucket_index * seats_per_bucket) {
      count_to_allocate = seats_per_bucket + (bucket_index * seats_per_bucket - students_allocated);
    } else {
      count_to_allocate = seats_per_bucket;
    }
  }

  // Above-median buckets: traverse from median toward max
  let r = median_cgpa;
  let bucket_index = 1;
  while (max_cgpa - r > epsilon) {
    let upper = r + stepper_above;
    if (max_cgpa - upper < 0.1) upper = max_cgpa;
    await allocateBucket(r, upper, bucket_index);
    bucket_index++;
    r = upper;
  }

  // Below-median buckets: traverse from min toward median
  r = min_cgpa;
  while (median_cgpa - r > epsilon) {
    let upper = r + stepper_below;
    if (median_cgpa - upper < 0.1) upper = median_cgpa;
    await allocateBucket(r, upper, bucket_index);
    bucket_index++;
    r = upper;
  }

  // Mark unallocated students in this course
  const unallocQuery = `
    UPDATE preferences
    SET status = -final_preference,
        allocation_status = CASE
            WHEN final_preference = $1 THEN 'CGPA not in range'
            WHEN final_preference > $1 AND status = 0 THEN 'Seats filled at higher preference'
        END
    WHERE instance_course_id = $2
      AND status = 0
  `;
  await pool.query(unallocQuery, [preference_no, instance_course_id]);

  // Update instance_courses (INCREMENT — not absolute)
  const total = parseInt(course.total_allocations) + students_allocated;
  const allocation_status = total >= course.max_intake ? 'Allocated' : 'Pending';
  const updateCourseQuery = `
    UPDATE instance_courses
    SET total_allocations = total_allocations + $1,
        allocation_status = $2
    WHERE id = $3
  `;
  await pool.query(updateCourseQuery, [students_allocated, allocation_status, instance_course_id]);

  return students_allocated;
}
```

---

#### 3.10 — `runAllocate(instance_id)` (orchestrator for Phase 3)

```javascript
async function runAllocate(instance_id) {
  // Re-run Phase 1 first (mirrors PHP behavior)
  await setFinalPreferences(instance_id);
  const phase1Courses = await getCourseDetailsByPreference(instance_id, 1);
  for (const course of phase1Courses) {
    if (course.min_intake > course.p_count) {
      await rejectCourses(course.instance_course_id);
    }
  }

  // Get max preference depth
  const max_preference = await getMaxPreference(instance_id);

  // Loop through each preference round
  for (let i = 1; i <= max_preference; i++) {
    const courses = await getCourseDetailsByPreference(instance_id, i);
    for (const course of courses) {
      const availability = course.max_intake - course.total_allocations;
      if (availability <= 0) continue;

      if (course.p_count > availability) {
        await allocateStudentsUsingMedian(course, i, availability, instance_id);
      } else {
        await allocateStudents(course, i, availability, instance_id);
      }
    }
  }

  return { message: 'Allocation complete' };
}
```

---

#### 3.11 — `resetAllocation(instance_id)`

```javascript
async function resetAllocation(instance_id) {
  const resetPrefsQuery = `
    UPDATE preferences
    SET allocation_status = 'Pending',
        status = 0,
        final_preference = 0
    WHERE instance_course_id IN (
        SELECT id FROM instance_courses WHERE instance_id = $1
    )
  `;
  await pool.query(resetPrefsQuery, [instance_id]);

  const resetCoursesQuery = `
    UPDATE instance_courses
    SET total_allocations = 0,
        allocation_status = 'Pending'
    WHERE instance_id = $1
  `;
  await pool.query(resetCoursesQuery, [instance_id]);

  return true;
}
```

---

#### 3.12 — `getStudentsAllocationAll(instance_id)`

```javascript
async function getStudentsAllocationAll(instance_id) {
  const query = `
    SELECT
        students.name,
        students.usn,
        courses.coursename,
        courses.coursecode
    FROM preferences
    JOIN instance_courses ON instance_courses.id = preferences.instance_course_id
    JOIN students ON students.usn = preferences.usn
    JOIN courses ON instance_courses.coursecode = courses.coursecode
    JOIN instances ON instances.id = instance_courses.instance_id
    WHERE preferences.status = preferences.final_preference
      AND preferences.allocation_status = 'Allotted'
      AND instances.id = $1
    ORDER BY students.usn, students.department_id
  `;
  const result = await pool.query(query, [instance_id]);
  return result.rows;
}
```

---

#### 3.13 — `getPreferenceStatisticsDetails(instance_id)`

Use the large CTE query from Part 4 Phase 6 above.  
Replace `:instance_id` with `$1`. Return `result.rows`.

---

### Step 4: Create the Frontend API Module

**File location:** `client/src/api/allocation.api.js`  
**Action:** Create this new file.

This file mirrors the pattern of the existing API files (e.g., `preferences.api.js`). It uses the `axios` instance already configured in `client/src/api/axios.js`.

```javascript
// allocation.api.js uses the axios instance from client/src/api/axios.js
// Pattern: POST requests sending { instance_id } in the body.

Functions to implement:

1. getStatistics(instance_id)
   → POST /api/allocation/statistics
   → Body: { instance_id }
   → Returns: array of course statistics rows

2. startAllocation(instance_id)
   → POST /api/allocation/start
   → Body: { instance_id }
   → Returns: { rejectedCourses, message }

3. upgradePreferences(instance_id)
   → POST /api/allocation/upgrade-preferences
   → Body: { instance_id }
   → Returns: { message }

4. runAllocate(instance_id)
   → POST /api/allocation/allocate
   → Body: { instance_id }
   → Returns: { message }

5. resetAllocation(instance_id)
   → POST /api/allocation/reset
   → Body: { instance_id }
   → Returns: { message }

6. downloadAllocation(instance_id)
   → POST /api/allocation/download
   → Body: { instance_id }
   → Returns: array of { name, usn, coursename, coursecode }
```

---

### Step 5: Implement the Frontend Page

**File location:** `client/src/pages/admin/Allocation.jsx`  
**Action:** The file already exists. Implement the following UI and logic.

#### 5a. State variables needed

| State | Initial Value | Purpose |
|---|---|---|
| `instances` | `[]` | List of all elective instances (for dropdown) |
| `selectedInstance` | `''` | Currently selected instance_id |
| `allocationPhase` | `'idle'` | Current workflow phase: `'idle'`, `'start_done'`, `'upgrade_done'`, `'allocated'` |
| `rejectedCourses` | `[]` | Course IDs rejected in Phase 1 |
| `statistics` | `[]` | Course statistics rows for display after allocation |
| `loading` | `false` | Loading spinner state |
| `notification` | `null` | Success/error message |

#### 5b. On page load (useEffect)

Fetch all instances from the existing instances API (`instance.api.js`) and populate the dropdown.

#### 5c. UI structure and interactions

**Section 1: Instance Selector (always visible)**

```
Box title: "Choose Elective Instance"
  <select> tag:
      onChange → setSelectedInstance, reset phase to 'idle', clear statistics
      Default option: value="" text="Select Elective Instances"
      Other options: one per instance row (value=instance.id, text=instance.instancename)
  
  <button> "Start":
      Disabled if selectedInstance is empty or ''
      onClick → calls handleStart()
```

**handleStart():**
1. Set `loading = true`.
2. Call `startAllocation(selectedInstance)` from `allocation.api.js`.
3. On success: set `allocationPhase = 'start_done'`, save `rejectedCourses` from response.
4. Set `loading = false`.

---

**Section 2: Phase 1 result (visible when `allocationPhase === 'start_done'`)**

Show a warning-colored box with heading: "Upgrade the student preferences"  
List each rejected course ID (or message "N course(s) rejected").  

```
<button> "Upgrade Preferences" (warning/yellow color):
    onClick → calls handleUpgradePreferences()
```

**handleUpgradePreferences():**
1. Set `loading = true`.
2. Call `upgradePreferences(selectedInstance)`.
3. On success: set `allocationPhase = 'upgrade_done'`.
4. Set `loading = false`.

---

**Section 3: Phase 2 result (visible when `allocationPhase === 'upgrade_done'`)**

Show a success-colored box: "Preferences are Upgraded Successfully"

```
<button> "Allocate" (primary/blue color):
    onClick → calls handleAllocate()
```

**handleAllocate():**
1. Set `loading = true`.
2. Call `runAllocate(selectedInstance)`.
3. On success: set `allocationPhase = 'allocated'`.
4. Also call `getStatistics(selectedInstance)` and set `statistics`.
5. Set `loading = false`.

---

**Section 4: Post-allocation statistics table (visible when `allocationPhase === 'allocated'` or when statistics data available after instance change)**

This section can also be shown immediately when an instance is selected (to see current allocation state), by calling `getStatistics` on instance selection change.

Table columns (in order):
1. `#` (row number)
2. Course Name (Code)
3. P1 Count
4. P1 Min Grade
5. P1 Median Grade
6. P1 Max Grade
7. P2 Count
8. P2 Min Grade
9. P2 Median Grade
10. P2 Max Grade
11. Division
12. Min Intake
13. Max Intake
14. Total Allocations
15. Allocation Status

Row background coloring (Tailwind classes):
- `allocation_status === 'Rejected'` → red background (e.g., `bg-red-100`)
- `allocation_status === 'Allocated'` → green background (e.g., `bg-green-100`)
- `allocation_status === 'Pending'` → gray background (e.g., `bg-gray-100`)

Grand total row at the bottom showing sum of all `total_allocations`.

---

#### 5d. Loading state

Show a loading spinner overlay or disable buttons while API calls are in progress.

#### 5e. Error handling

Show error messages using the existing `Notification` component from `client/src/components/common/Notification.jsx`.

---

### Step 6: Update app.js to Register Routes

**File location:** `server/src/app.js`  
**Action:** Add TWO lines.

**Line 1 (near the top with other requires):**
```javascript
const allocationRoutes = require('./routes/allocation.routes');
```

**Line 2 (near the other route `.use()` calls):**
```javascript
app.use('/api/allocation', allocationRoutes);
```

---

### Step 7: Handle Download on the Frontend

The download functionality in the PHP implementation uses a POST form submission that returns a binary CSV. In the PERN stack, the recommended approach:

1. Call `downloadAllocation(selectedInstance)` which returns a JSON array.
2. On the frontend, convert the array to CSV text using JavaScript.
3. Create a Blob and a temporary anchor tag to trigger file download.

```javascript
// CSV conversion example (in the component that has the Download button)
function downloadCSV(data) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student_allocations.csv';
  a.click();
  URL.revokeObjectURL(url);
}
```

The Download button on the Elective Preferences page (`ElectivePreference.jsx`) should call `downloadAllocation` and then route through this helper.

---

## Part 7 — Files Summary: What to Create and What to Update

| Action | File | Note |
|---|---|---|
| **Create** | `server/src/routes/allocation.routes.js` | New — all allocation endpoints |
| **Create** | `server/src/controllers/allocation.controller.js` | New — request handling |
| **Create** | `server/src/services/allocation.service.js` | New — all queries and business logic |
| **Create** | `client/src/api/allocation.api.js` | New — frontend API calls |
| **Update** | `server/src/app.js` | Add 2 lines: require + app.use |
| **Update** | `client/src/pages/admin/Allocation.jsx` | Implement the UI and API wiring |
| **Update** | `client/src/pages/admin/ElectivePreference.jsx` | Add Reset and Download buttons + their handlers |

No database migrations are needed — all tables already exist.  
No new model file is strictly required (queries live in the service).  
If the project uses a model layer for raw SQL abstractions, add `allocation.model.js` following the pattern of `instance.model.js`.

---

 

## Part 9 — Suggested Step-by-Step Test Sequence

Test in this order to catch issues early:

1. **Test `POST /api/allocation/start`** with a valid instance_id that has courses with low first-preference demand. Verify `instance_courses.allocation_status = 'Rejected'` in the database for under-subscribed courses.

2. **Test `POST /api/allocation/upgrade-preferences`** on the same instance. Verify `preferences.status = -1` and `preferences.allocation_status = 'Course Rejected'` for rejected course rows. Verify `final_preference` decremented for lower-ranked rows of same student.

3. **Test `POST /api/allocation/allocate`**. Verify `preferences.allocation_status = 'Allotted'` and `preferences.status = final_preference` for allocated students. Verify `instance_courses.total_allocations` updated.

4. **Test `POST /api/allocation/statistics`**. Verify the returned array contains correct `p1_count`, `total_allocations`, `allocation_status` per course.

5. **Test `POST /api/allocation/download`**. Verify only `Allotted` students are returned.

6. **Test `POST /api/allocation/reset`**. Verify all `preferences.status = 0`, `preferences.final_preference = 0`, `instance_courses.total_allocations = 0`.

7. **Test re-running allocation after reset**. Verify results match the first run.

8. **Test the UI end-to-end**: Start → phase shows Upgrade button → Upgrade → phase shows Allocate → Allocate → statistics table renders.

---

*End of Allocation.md*
