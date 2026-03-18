-- Migration: Create preferences table
CREATE TABLE IF NOT EXISTS public.preferences
(
    id integer NOT NULL DEFAULT nextval('preferences_id_seq'::regclass),
    instance_course_id integer NOT NULL,
    usn character varying(12) COLLATE pg_catalog."default" NOT NULL,
    preferred integer NOT NULL,
    final_preference integer NOT NULL,
    allocation_status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'Pending'::character varying,
    status integer NOT NULL,
    CONSTRAINT preferences_pkey PRIMARY KEY (id),
    CONSTRAINT preferences_allocation_status_check CHECK (allocation_status::text = ANY (ARRAY['Allotted'::character varying, 'Course Rejected'::character varying, 'Not Allotted'::character varying, 'Pending'::character varying]::text[]))
);
