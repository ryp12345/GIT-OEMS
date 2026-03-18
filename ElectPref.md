Elective Preferences

Purpose
- This document is the single source of truth for implementing the Elective Preferences feature in the new PERN system.
- It is intentionally written to preserve the current PHP/MySQL business behaviour as closely as possible.
- UI structure may change.
- Backend business rules must not change unless a deviation is explicitly approved.

Primary Goal
- If the new system is given the same tables, the same data, and the same user actions, it should produce the same outcomes as the current system for:
  - the Elective Instance dropdown
  - the preference summary table
  - course rejection
  - preference upgrading
  - student allocation
  - reset allocation behaviour
  - download output

How to Use This Document
- Product team can use it to understand feature behaviour.
- Developers can use it to implement backend logic.
- AI coding tools can use it as an implementation specification.
- QA can use it as a behaviour checklist.

Non-Negotiable Rule
- This feature is not just a reporting page.
- It is a business-logic feature built around student choices, course eligibility, seat capacity, and allocation outcomes.
- The visible table is only one part of the full behaviour.

Feature Scope

What the Elective Preferences feature includes
- Elective Instance selection
- Preference summary retrieval
- Preference statistics display
- access to allocation-related state
- reset allocations for an instance
- download of final allocated students for an instance
- course-level chart/statistics popup for allocated results

What this feature depends on
- instance setup
- instance-course mapping
- student preference records
- student academic records
- course seat settings
- allocation run state

Core Business Concepts

Elective Instance
- A single offering cycle of electives.
- Usually tied to semester and academic year.
- The selected instance controls the entire feature context.

Course Inside an Instance
- A course becomes operational only after being mapped to an instance.
- That mapping stores operational fields such as:
  - minimum intake
  - maximum intake
  - division
  - total allocations
  - allocation status

Preferred Rank
- The original order selected by the student.
- This is the student’s raw submitted ranking.

Final Preference Rank
- A working ranking used during allocation.
- It starts as a copy of preferred rank.
- It may change if some courses are rejected.

Student Preference Status
- A mutable state used during allocation.
- This state decides whether a student preference row is still pending, allotted, rejected, or closed for some reason.

Business Objective of the Screen
- Give the admin a summary of student demand for each course in the selected instance.
- Show how strong that demand is at different preference levels.
- Show how grades are distributed among interested students.
- Reflect the current allocation status of each course.

User Workflow

Step 1: Open the page
- The admin opens Elective Preferences from the sidebar.
- The page loads with the table body empty.
- The Elective Instance dropdown is populated.
- Reset and Download remain hidden until a valid instance is selected.

Step 2: Select an instance
- The admin chooses one Elective Instance.
- The UI sends the selected instance id to the backend.
- The backend returns the course preference summary for that instance.

Step 3: Show the summary table
- The UI displays one row per qualifying course.
- The table is generated dynamically based on the selected instance.

Step 4: Optional actions
- Reset Allocations becomes available.
- Download becomes available.
- If a course has allocated students, a chart button becomes available for that course.

Instance-Driven Behaviour Rule
- Everything on this screen is controlled by the selected instance.
- No cross-instance mixing should happen unless the current PHP behaviour already does it by mistake.

Data Meaning and Table Roles

This section describes the business role of the existing tables so the PERN implementation uses them correctly.

`instances`
- Stores each Elective Instance.
- Supplies the dropdown values.
- Also stores form status and instance-level metadata.

`courses`
- Stores course master data.
- Includes course name, course code, semester, department, and related course attributes.

`instance_courses`
- Stores the mapping between an instance and a course.
- This is the operational course record for allocation.
- Important fields used by this feature:
  - instance id
  - course code
  - min intake
  - max intake
  - division
  - total allocations
  - allocation status

`preferences`
- Stores student preference rows.
- Important fields used by this feature:
  - student identifier
  - instance course id
  - preferred
  - final preference
  - status
  - allocation status

`students`
- Stores student identity and department information.

`student_academic_records`
- Stores grades by semester.
- The grade used for preference statistics and allocation is taken from the semester matching the course semester.

`permitted_branches`
- Stores which departments/branches are allowed for an instance-course mapping.
- Not directly displayed in the Elective Preferences table, but still part of the overall instance-course setup.

Summary Table Behaviour

Row Inclusion Rule
- The current PHP implementation builds rows from preference-driven data, not from all mapped courses.
- Therefore a course appears in the table only if there is at least one preference record for that course in the selected instance.
- A mapped course with no preference rows will not naturally appear.
- Preserve this behaviour if exact parity is required.

Displayed Columns in the Current UI
- Sl.No
- Course Name
- Preference 1 count
- Preference 1 min grade
- Preference 1 median grade
- Preference 1 max grade
- Preference 2 count
- Preference 2 min grade
- Preference 2 median grade
- Preference 2 max grade
- Div
- Min
- Max
- Allocations
- Status
- An unlabeled action column may also appear in generated rows when chart viewing is available

Important Backend Capability Rule
- The backend currently calculates statistics for preference levels 1 through 5.
- The visible table currently shows only levels 1 and 2.
- The PERN backend should preserve support for all 5 levels even if the frontend only displays some of them.

Column Meanings

Sl.No
- Sequential display number starting from 1.

Course Name
- Course name plus course code.

Preference N Count
- Number of students whose original preferred rank for this course equals N in the selected instance.

Preference N Min Grade
- Lowest grade among students in that preference group.

Preference N Median Grade
- Middle grade among students in that preference group.
- If the count is even, use the average of the two middle grades.

Preference N Max Grade
- Highest grade among students in that preference group.

Div
- Division configured for that course inside the instance.

Min
- Minimum intake configured for that course inside the instance.

Max
- Maximum intake configured for that course inside the instance.

Allocations
- Number of students already assigned to that course in the current instance.

Status
- Current course-level allocation state.
- Common values are Pending, Allocated, Rejected.

How the Summary Statistics Are Calculated

Source Data Used
- preferences
- instance_courses
- instances
- courses
- students
- student_academic_records

Join Meaning
- A preference row identifies a student’s interest in a course instance.
- The course record identifies the semester.
- The student academic record supplies the grade for that semester.

Grouping Rule
- Group students by:
  - instance course
  - preference number

Calculated Measures per group
- count
- minimum grade
- maximum grade
- median grade

Median Rule
- Sort grades ascending within the same course and preference bucket.
- If count is odd, use the exact middle grade.
- If count is even, average the two middle grades.

Important Rule About Which Preference Field Is Used
- The summary table uses the original `preferred` rank.
- It does not use `final_preference`.
- This is intentional in the current system.
- Preserve it unless business owners explicitly decide to change the meaning of the page.

Course Chart Behaviour

When the chart button appears
- Only when the course has total allocations greater than zero.

What the chart represents
- It groups allocated students into grade bands.
- It also separates them by final preference.

Grade bands used by the current system
- 9-10
- 8-9
- 7-8
- 6-7
- 5-6
- Below 5

Important Chart Rule
- The chart is based on allocated students only.
- It is not a chart of all interested students.

Business Status Vocabulary

Course-level statuses
- Pending
  - the course still has room or allocation is not fully finalized
- Allocated
  - the course is treated as filled under the current logic
- Rejected
  - the course is rejected before normal allocation because first-preference demand is below minimum intake

Preference-row statuses and reasons
- Pending
  - default state before allocation
- Allotted
  - this preference row was selected in allocation
- Course Rejected
  - the course itself was rejected
- CGPA not in range
  - the student was not selected in the oversubscription banding logic for the current preference round
- Seats filled at higher preference
  - the student did not get this row because the process filled them elsewhere or the course filled earlier in the process

Allocation Model

This is the most important part of the feature.

Allocation Preparation Phase

Step A: Initialize final preference
- At the start of an allocation run for an instance, copy `preferred` into `final_preference` for all preference rows in that instance.
- This means every fresh allocation run starts from the original student choices.

Step B: Evaluate first-preference demand
- For each course in the selected instance, inspect demand at preference 1.
- Compare first-preference count with minimum intake.

Step C: Reject under-subscribed courses
- If first-preference count is less than minimum intake, reject that course.
- Update the course-level status to Rejected.

Step D: Update student rows for rejected courses
- For every preference row belonging to the rejected course:
  - set allocation status to Course Rejected
  - set status to -1

Step E: Upgrade final preferences after rejection
- For each affected student, reduce by 1 the `final_preference` of any lower-priority remaining preferences that came after the rejected course.
- Example:
  - original final preferences: 1, 2, 3, 4
  - if the preference 2 course is rejected
  - updated final preferences become: 1, rejected, 2, 3

Allocation Execution Phase

Round Order Rule
- Allocation proceeds in ascending order of `final_preference`.
- Start at 1.
- Continue until the maximum final preference value still present in the instance.

Per-Round Course Selection Rule
- For the current final preference number, include only courses that are not already Rejected and not already Allocated.

Availability Rule
- Available seats for a course are:
  - max intake minus total allocations

Branch 1: Simple allocation path
- Use this when demand for the current course and current final preference is less than or equal to availability.

Simple allocation behaviour
- All eligible students in that current final preference bucket are allotted.
- Their preference rows become Allotted.
- If the course becomes full, remaining lower-priority pending rows for that course are marked as Seats filled at higher preference.
- Course allocation status becomes:
  - Allocated if full
  - Pending if not full

Branch 2: Oversubscription path
- Use this when demand for the current course and current final preference is greater than availability.
- The current system uses median-based band allocation.

Median-Based Oversubscription Logic

Inputs used
- minimum grade in the current bucket
- median grade in the current bucket
- maximum grade in the current bucket
- available seats

Band construction
- Split the grade span into 6 segments:
  - 3 above median
  - 3 below median

Seat share per segment
- Base seats per segment are calculated as round(available seats / 6).

Processing order
- Process above-median bands first.
- Then process below-median bands.
- Within each band, higher grades are selected first.

Catch-up rule
- If one band does not fill its expected share, the next band increases its pick count to compensate.

Selection rule
- Only rows still pending in the current run are eligible.
- Only rows in the current final preference bucket are considered for selection into seats.

Post-selection rule for non-selected rows
- For the same course, remaining pending rows are updated as follows:
  - if the row belongs to the current final preference round, mark it as CGPA not in range
  - if the row belongs to a later final preference and remains pending, mark it as Seats filled at higher preference

Student Settlement Rule
- Once a student is allotted during the current run, that student is effectively removed from future allocation consideration within the same instance.
- Preserve this behaviour.

Course Total Allocation Update Rule
- The current PHP implementation updates totals slightly differently in the two paths:
  - simple path sets the total allocation count based on the counted allotted rows
  - median path increments total allocations by the newly allocated count
- If exact parity is required, preserve this behaviour.

Course Status Update Rule
- If total allocations reach or exceed max intake, course status becomes Allocated.
- Otherwise it remains Pending.

Reset Allocation Behaviour

What Reset means
- Reset is scoped to one selected instance.
- It clears the results of allocation.
- It does not delete the original preference choices.

What Reset updates on preference rows
- allocation status becomes Pending
- status becomes 0
- final preference becomes 0

What Reset updates on instance-course rows
- total allocations becomes 0
- allocation status becomes Pending

Important Reset Rule
- Reset does not erase `preferred`.
- On the next allocation run, `final_preference` is rebuilt from `preferred`.

Download Behaviour

What Download returns
- A CSV file of allotted students for the selected instance.

Rows included in Download
- Only rows that represent final allotted outcomes.

Current export fields
- student name
- student USN
- course name
- course code

Implementation Contract for PERN

This section defines what the PERN backend should provide so the existing UI can be connected cleanly.

Suggested backend responsibilities
- provide Elective Instance options
- provide Elective Preferences summary for a selected instance
- provide chart/statistics data for a course in an instance
- reset allocations for an instance
- trigger allocation for an instance
- download allotted students for an instance

Suggested API surface

1. Get instances
- Purpose: populate Elective Instance dropdown
- Input: none
- Output: list of instances ordered newest first

2. Get elective preference summary by instance
- Purpose: populate the table after dropdown selection
- Input: instance id
- Output: one row per qualifying course with all summary columns and action availability flags

3. Get course allocation chart data
- Purpose: populate the chart popup
- Input: instance id, course code or instance-course id
- Output: grade-band-wise allocated counts grouped by final preference

4. Reset allocations
- Purpose: clear current allocation results for the instance
- Input: instance id
- Output: success or failure

5. Run allocation
- Purpose: execute the full allocation workflow for the instance
- Input: instance id
- Output: summary of courses rejected, students allotted, and final course states

6. Download allocations
- Purpose: export final allotted students
- Input: instance id
- Output: CSV stream

Important Note for Backend Design
- Endpoint naming can change.
- Payload structure can change.
- The outputs must still represent the same business results.

Suggested Response Shape for Summary Rows
- serial number
- course name
- course code
- preference 1 count
- preference 1 min grade
- preference 1 median grade
- preference 1 max grade
- preference 2 count
- preference 2 min grade
- preference 2 median grade
- preference 2 max grade
- division
- min intake
- max intake
- total allocations
- allocation status
- has chart button

Suggested Allocation Service Flow

Phase 1: initialize
1. copy preferred to final preference for all rows in the instance

Phase 2: reject under-subscribed courses
2. inspect first-preference demand for each course
3. reject any course with first-preference count less than min intake
4. mark related preference rows as Course Rejected and status -1
5. upgrade remaining final preferences for affected students

Phase 3: allocate round by round
6. read max final preference in the instance
7. for preference round from 1 to max final preference:
8. fetch eligible courses for that round
9. for each course:
10. calculate availability
11. if demand <= availability, run simple allocation
12. else run median-based allocation
13. update preference rows
14. update course totals and course status

Phase 4: final outputs
15. provide final summary state for UI or export

Exact Behaviour Rules to Preserve

1. Instance controls the context
- Every operation in this feature is scoped to the chosen instance.

2. Summary rows are preference-driven
- The summary table shows only courses with preference rows in the selected instance.

3. Summary uses preferred rank
- The summary page is based on original preference rank.

4. Allocation uses final preference
- Final preference is the working rank after reordering caused by rejected courses.

5. Minimum intake decides rejection
- Course rejection is based on first-preference count compared with minimum intake.

6. Maximum intake decides seat limit
- Allocation cannot exceed course capacity.

7. Oversubscription uses median-based banding
- Do not replace this with a simpler sort-only approach if parity is required.

8. Reset preserves raw student choice
- Reset clears allocation state, not original preference order.

9. Download exports allotted results only
- Not all preference rows.

Known Current-System Quirks

These are current behaviours that may be technical quirks rather than domain rules.
- If strict parity is the goal, preserve them.
- If the new system is allowed to improve them, document the change before implementing.

Quirk 1: Chart lookup is course-code based
- The current chart helper looks up by course code, not strictly by instance-course pairing.

Quirk 2: Table computes more preference levels than it displays
- Backend computes 1 through 5.
- UI shows only 1 and 2 in the main table.

Quirk 3: Courses with no preferences do not appear
- Even if mapped to the instance.

Quirk 4: Allocation totals are updated differently in the two allocation paths
- Preserve if exact output parity matters.

Quirk 5: The generated table row contains an extra action cell
- The visible header does not explicitly name that column.

Acceptance Criteria for the PERN Rewrite

The new implementation should be accepted only if the following are true for the same database contents.

Summary behaviour
- Selecting an instance returns the same courses as the PHP version.
- Each row shows the same count, min, median, max values.
- Division, min, max, total allocations, and status match.

Rejection behaviour
- The same courses are rejected.
- The same student rows become Course Rejected.

Preference upgrade behaviour
- Final preference ranks shift exactly the same way after rejection.

Allocation behaviour
- The same students are allotted for each course and each round.
- Oversubscribed courses follow the same median-band selection behaviour.
- Course totals and course statuses match the PHP results.

Reset behaviour
- Reset returns all allocation-related fields to the same baseline state as the current system.

Download behaviour
- The CSV contains the same allotted student-course pairs as the PHP version.

Guidance for Copilot or Any AI Implementation Tool

If this document is used with an AI coding tool, the instruction should be:
- implement the Elective Preferences backend using the exact business behaviour described here
- preserve current status meanings and result semantics
- do not simplify the allocation logic
- do not reinterpret `preferred` and `final_preference`
- do not change row inclusion rules unless explicitly asked
- assume the frontend already exists and only backend parity is required

Final Rule
- If there is ever a conflict between a cleaner implementation and matching the current business result, choose behavioural parity first unless product owners explicitly approve a rule change.