-- Migration: Create instances table
CREATE TABLE IF NOT EXISTS public.instances
(
    id integer NOT NULL DEFAULT nextval('instances_id_seq'::regclass),
    instancename character varying(255) COLLATE pg_catalog."default" NOT NULL,
    semester integer NOT NULL,
    academic_year character varying(12) COLLATE pg_catalog."default" NOT NULL,
    status character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'Active'::character varying,
    CONSTRAINT instances_pkey PRIMARY KEY (id),
    CONSTRAINT instances_status_check CHECK (status::text = ANY (ARRAY['Active'::character varying, 'Inactive'::character varying]::text[]))
);
