-- DOWN: Remove auto-increment from instance_courses.id
BEGIN;

ALTER TABLE instance_courses 
    ALTER COLUMN id DROP DEFAULT;

DROP SEQUENCE IF EXISTS instance_courses_id_seq;

COMMIT;