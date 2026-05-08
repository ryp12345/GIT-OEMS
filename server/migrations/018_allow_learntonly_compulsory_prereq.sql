-- Migration: Allow LearntOnly compulsory prerequisite mode
ALTER TABLE public.courses
    ALTER COLUMN compulsory_prereq TYPE character varying(20);

ALTER TABLE public.courses
    DROP CONSTRAINT IF EXISTS courses_compulsory_prereq_check;

ALTER TABLE public.courses
    ADD CONSTRAINT courses_compulsory_prereq_check
    CHECK (
        compulsory_prereq::text = ANY (
            ARRAY[
                'Yes'::character varying,
                'No'::character varying,
                'LearntOnly'::character varying,
                ''::character varying
            ]::text[]
        )
    );
