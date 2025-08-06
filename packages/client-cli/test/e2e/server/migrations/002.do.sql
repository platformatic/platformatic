
-- Add SQL in this file to create the database tables for your API
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  quote TEXT NOT NULL,
  movie_id INTEGER NOT NULL REFERENCES movies(id)
);
