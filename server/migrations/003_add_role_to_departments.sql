-- Migration: Add role column to departments table
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS role character varying(20) DEFAULT 'hod';
-- Set dean/admin role for special users (example)
UPDATE public.departments SET role = 'dean' WHERE username = 'dean@git.edu';
UPDATE public.departments SET role = 'admin' WHERE username = 'itcell@git.edu';
-- All others default to 'hod' unless specified
