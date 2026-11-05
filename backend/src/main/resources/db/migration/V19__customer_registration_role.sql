INSERT INTO roles(code, name) VALUES ('CUSTOMER', 'Customer') ON CONFLICT (code) DO NOTHING;
