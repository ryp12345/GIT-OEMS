-- Migration: Create elective_group table
CREATE TABLE IF NOT EXISTS public.elective_group
(
    id integer NOT NULL DEFAULT nextval('elective_group_id_seq'::regclass),
    group_name character varying(50) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT elective_group_pkey PRIMARY KEY (id)
);
