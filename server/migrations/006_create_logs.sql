-- Migration: Create logs table
CREATE TABLE IF NOT EXISTS public.logs
(
    id integer NOT NULL DEFAULT nextval('logs_id_seq'::regclass),
    username character varying(20) COLLATE pg_catalog."default" NOT NULL,
    function character varying(100) COLLATE pg_catalog."default" NOT NULL,
    exception character varying(625) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logs_pkey PRIMARY KEY (id)
);
