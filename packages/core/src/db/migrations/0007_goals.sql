-- Spending / saving goals.
--
-- A goal sits "above" a budget: it's a longer-horizon target with a
-- deadline. Examples:
--   - "Spend less than $5,000 on travel between Jun and Aug"
--   - "Keep eating-out under $300/week, indefinitely"
--   - "Save $10,000 by Dec 31" (not yet — needs income tracking)
--
-- We start with the spending-cap variant only because we have the data
-- for it directly. The savings variant lands when we add income.

CREATE TABLE IF NOT EXISTS goals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  category        TEXT,                       -- nullable = all spend
  cap_cents       INTEGER NOT NULL,
  period          TEXT    NOT NULL CHECK (period IN ('weekly','monthly','annual','custom')),
  start_date      INTEGER,                    -- ms epoch, used for custom
  end_date        INTEGER,                    -- ms epoch, used for custom
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
