-- Migration: Create student_academic_records table
CREATE TABLE IF NOT EXISTS public.student_academic_records
(
    id bigint NOT NULL DEFAULT nextval('student_academic_records_id_seq'::regclass),
    usn character varying(12) COLLATE pg_catalog."default" NOT NULL,
    semester character varying(255) COLLATE pg_catalog."default" NOT NULL,
    grade character varying(255) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT student_academic_records_pkey PRIMARY KEY (id)
);
