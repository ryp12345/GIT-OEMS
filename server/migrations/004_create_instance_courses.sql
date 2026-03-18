-- Migration: Create instance_courses table
CREATE TABLE IF NOT EXISTS public.instance_courses
(
    id integer NOT NULL DEFAULT nextval('instance_courses_id_seq'::regclass),
    instance_id integer NOT NULL,
    coursecode character varying(10) COLLATE pg_catalog."default" NOT NULL,
    division smallint NOT NULL,
    min_intake smallint NOT NULL,
    max_intake integer NOT NULL,
    total_allocations integer,
    allocation_status character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'Pending'::character varying,
    CONSTRAINT instance_courses_pkey PRIMARY KEY (id),
    CONSTRAINT instance_courses_allocation_status_check CHECK (allocation_status::text = ANY (ARRAY['Pending'::character varying, 'Allocated'::character varying, 'Rejected'::character varying, ''::character varying]::text[]))
);
