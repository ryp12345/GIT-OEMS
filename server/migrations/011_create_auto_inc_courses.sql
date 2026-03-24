-- UP: Add auto-increment to courses.id (safe, atomic)
BEGIN;

DO $$
DECLARE
  max_id  BIGINT;
  seq_name TEXT := 'courses_id_seq';
  seq_last BIGINT;
BEGIN
  -- prevent concurrent inserts while we inspect and set the sequence
  LOCK TABLE courses IN EXCLUSIVE MODE;

  -- determine current max id under lock
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM courses;

  -- create sequence if missing (start at max_id + 1)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relkind = 'S'
      AND c.relname = seq_name
  ) THEN
    EXECUTE format(
      'CREATE SEQUENCE %I START WITH %s INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1',
      seq_name, max_id + 1
    );
  END IF;

  -- read current sequence last_value
  EXECUTE format('SELECT last_value FROM %I', seq_name) INTO seq_last;

  -- set sequence to the greater of current last_value and table max
  PERFORM setval(seq_name, GREATEST(COALESCE(seq_last, 0), max_id));
END
$$;

-- set default for id column and own the sequence by the column
ALTER TABLE courses
  ALTER COLUMN id SET DEFAULT nextval('courses_id_seq');

ALTER SEQUENCE courses_id_seq OWNED BY courses.id;

COMMIT;
