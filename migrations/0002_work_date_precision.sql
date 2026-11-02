-- 0002_work_date_precision.sql
-- Some imported works have no reliable completion date. Keep that fact
-- separate from the display order: date_precision says whether the date is
-- usable, sort_rank forces the order for works whose dates are unknown.

ALTER TABLE works ADD COLUMN sort_rank INTEGER;
ALTER TABLE works ADD COLUMN date_precision TEXT NOT NULL DEFAULT 'day';

CREATE INDEX IF NOT EXISTS idx_works_sort_rank
  ON works (sort_rank)
  WHERE sort_rank IS NOT NULL;
