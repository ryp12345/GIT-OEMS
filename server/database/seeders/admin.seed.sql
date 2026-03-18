-- Admin seeder placeholder
INSERT INTO users (email, password, role) VALUES ('admin@example.com','admin', 'admin') ON CONFLICT DO NOTHING;
