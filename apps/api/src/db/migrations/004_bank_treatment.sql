-- Migration 004: let admins decide whether a day's extra/missing minutes go to the
-- hour bank ('bank') or are settled in payroll ('payroll': falta descontada em
-- folha / hora extra paga). Payroll entries are excluded from the hour-bank balance.
-- Existing entries stay 'bank' (no silent change); reclassify them from the UI.
-- Run: wrangler d1 execute controle-ponto-db --file=src/db/migrations/004_bank_treatment.sql

ALTER TABLE time_entries ADD COLUMN bank_treatment TEXT NOT NULL DEFAULT 'bank'
  CHECK(bank_treatment IN ('bank','payroll'));

-- Default treatment applied to new absences ('absence' day type). Starts as 'bank'
-- (same behavior as before); the admin switches it in Configurações.
ALTER TABLE companies ADD COLUMN absence_treatment_default TEXT NOT NULL DEFAULT 'bank'
  CHECK(absence_treatment_default IN ('bank','payroll'));
