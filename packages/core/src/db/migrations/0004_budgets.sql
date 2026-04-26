-- Per-category monthly budgets.
--
-- Each row caps a category's monthly spend at amount_cents. The pipeline's
-- post-processing pass evaluates these and creates an alert when ≥80% of
-- the cap is consumed in the current calendar month.

CREATE TABLE IF NOT EXISTS budgets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT    NOT NULL UNIQUE,
  amount_cents  INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
