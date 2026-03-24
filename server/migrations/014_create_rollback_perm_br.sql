-- DOWN: Remove auto-increment from permitted_branches.id
BEGIN;

-- Remove the default value from id column
ALTER TABLE permitted_branches 
    ALTER COLUMN id DROP DEFAULT;

-- Drop the sequence (will be automatically disassociated due to OWNED BY)
DROP SEQUENCE IF EXISTS permitted_branches_id_seq;

COMMIT;