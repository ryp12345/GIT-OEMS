-- Migration: Create departments table
CREATE TABLE IF NOT EXISTS public.departments
(
    deptid integer NOT NULL DEFAULT nextval('departments_deptid_seq'::regclass),
    name character varying(50) COLLATE pg_catalog."default" DEFAULT ''::character varying,
    shortname character varying(5) COLLATE pg_catalog."default" NOT NULL,
    username character varying(20) COLLATE pg_catalog."default",
    password character varying(100) COLLATE pg_catalog."default",
    datestmp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT departments_pkey PRIMARY KEY (deptid)
);
