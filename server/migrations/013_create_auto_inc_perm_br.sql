-- UP: Add auto-increment to permitted_branches.id (safe, atomic)
BEGIN;

DO $$
DECLARE
  max_id  BIGINT;
  seq_name TEXT := 'permitted_branches_id_seq';
  seq_last BIGINT;
BEGIN
  -- prevent concurrent inserts while we inspect and set the sequence
  LOCK TABLE permitted_branches IN EXCLUSIVE MODE;

  SELECT COALESCE(MAX(id), 0) INTO max_id FROM permitted_branches;

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

  EXECUTE format('SELECT last_value FROM %I', seq_name) INTO seq_last;

  PERFORM setval(seq_name, GREATEST(COALESCE(seq_last, 0), max_id));
END
$$;

ALTER TABLE permitted_branches 
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE permitted_branches
  ALTER COLUMN id SET DEFAULT nextval('permitted_branches_id_seq');

ALTER SEQUENCE permitted_branches_id_seq OWNED BY permitted_branches.id;

COMMIT;