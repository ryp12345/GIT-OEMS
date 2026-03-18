-- Migration: Create students table
CREATE TABLE IF NOT EXISTS public.students
(
    id bigint NOT NULL DEFAULT nextval('students_id_seq'::regclass),
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    uid character varying(12) COLLATE pg_catalog."default" NOT NULL,
    usn character varying(12) COLLATE pg_catalog."default" NOT NULL,
    department_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_pkey PRIMARY KEY (id)
);
