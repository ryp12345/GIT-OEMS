-- Migration: Create courses table
CREATE TABLE IF NOT EXISTS public.courses
(
    id bigint NOT NULL DEFAULT nextval('courses_id_seq'::regclass),
    elective_group_id bigint,
    coursename character varying(100) COLLATE pg_catalog."default",
    coursecode character varying(10) COLLATE pg_catalog."default" NOT NULL,
    pre_req character varying(200) COLLATE pg_catalog."default",
    department_id integer,
    semester integer NOT NULL,
    compulsory_prereq character varying(5) COLLATE pg_catalog."default" DEFAULT 'No'::character varying,
    restricted character varying(10) COLLATE pg_catalog."default",
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    CONSTRAINT courses_pkey PRIMARY KEY (id),
    CONSTRAINT courses_compulsory_prereq_check CHECK (compulsory_prereq::text = ANY (ARRAY['Yes'::character varying, 'No'::character varying, ''::character varying]::text[]))
);
