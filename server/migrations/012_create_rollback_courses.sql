-- DOWN: Revert the changes
BEGIN;

-- Remove the default value from id column
ALTER TABLE courses 
    ALTER COLUMN id DROP DEFAULT;

-- Drop the sequence (will be automatically disassociated due to OWNED BY)
DROP SEQUENCE IF EXISTS courses_id_seq;

COMMIT;