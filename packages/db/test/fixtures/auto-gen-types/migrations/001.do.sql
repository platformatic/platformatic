CREATE TABLE movies (
  year INTEGER NOT NULL,
  id INTEGER PRIMARY KEY,
  box_office INTEGER,
  title VARCHAR(255) NOT NULL
);

CREATE TABLE aggregate_ratings (
  movie_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  rating_type VARCHAR(255) NOT NULL,
  id INTEGER PRIMARY KEY,
  FOREIGN KEY (movie_id) REFERENCES movies (id)
);
