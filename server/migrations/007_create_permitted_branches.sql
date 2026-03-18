-- Migration: Create permitted_branches table
CREATE TABLE IF NOT EXISTS public.permitted_branches
(
    id integer NOT NULL DEFAULT nextval('permitted_branches_id_seq'::regclass),
    instance_course_id integer NOT NULL,
    department_id integer NOT NULL,
    CONSTRAINT permitted_branches_pkey PRIMARY KEY (id)
);
