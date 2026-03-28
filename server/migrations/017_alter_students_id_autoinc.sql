-- Migration: Make 'id' column in 'students' table auto-increment
-- This will create a sequence and set the default for the 'id' column


-- 1. Create the sequence if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS students_id_seq;

-- 2. Set the default for the id column
ALTER TABLE students ALTER COLUMN id SET DEFAULT nextval('students_id_seq');

-- 3. Set the sequence to the current max id
SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM students), 1));

-- 4. Link the sequence to the column
ALTER SEQUENCE students_id_seq OWNED BY students.id;
