/* create quotes table */
CREATE TABLE quotes (
  id INTEGER PRIMARY KEY NOT NULL,
  quote VARCHAR(255) NOT NULL,
  movie_id INTEGER NOT NULL REFERENCES movies(id)
);
