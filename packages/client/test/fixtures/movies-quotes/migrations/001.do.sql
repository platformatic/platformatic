
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  realeased_date DATE,
  created_at TIMESTAMP,
  preferred BOOLEAN DEFAULT FALSE
);
