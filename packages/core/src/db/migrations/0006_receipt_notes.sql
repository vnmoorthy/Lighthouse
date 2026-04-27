-- Free-text user notes on a receipt. Useful for things the LLM extractor
-- can't see ("this was for Sarah's birthday", "deductible — gift to client").
ALTER TABLE receipts ADD COLUMN user_note TEXT;
