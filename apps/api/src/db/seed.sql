-- Seed inicial — Alexandre Motos
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/seed.sql

-- Company
INSERT OR IGNORE INTO companies (id, name, cnpj, address, city)
VALUES (
  'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5',
  'Alexandre Motos',
  '21.693.712/0001-03',
  'Av. Colet. Artur Trindade, 1488, Jd. Alterosa',
  'Betim - MG'
);

-- Admin user (senha: Admin@123 — troque no primeiro acesso)
-- Hash gerado com bcrypt cost=12 para "Admin@123"
INSERT OR IGNORE INTO users (id, company_id, email, password_hash, name, role)
VALUES (
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5',
  'admin@alexandremotos.com.br',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J7hD5GpTG',
  'Administrador',
  'admin'
);

-- Employees (from spreadsheet)
INSERT OR IGNORE INTO employees (id, company_id, name, role, admission_date, weekday_start, weekday_end, saturday_start, saturday_end, works_saturday, tolerance_minutes, daily_hours_expected)
VALUES
  ('emp001', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Jessica Nascimento dos Santos', 'Auxiliar Administrativo', '2024-07-02', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0),
  ('emp002', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Marcos Vinicius Silva Freitas',  'Ajudante de Mecânico',    '2024-07-13', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0),
  ('emp003', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Vinicius',                        'Mecânico',                '2024-07-05', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0),
  ('emp004', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Arthur',                          'Mecânico',                '2024-07-16', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0),
  ('emp005', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Raissa',                          'Auxiliar',                '2025-04-15', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0),
  ('emp006', 'e7f3b2a1c4d5e6f7a8b9c0d1e2f3a4b5', 'Emilly',                          'Auxiliar',                '2025-02-10', '08:30', '18:00', '08:00', '12:00', 1, 10, 8.0);
