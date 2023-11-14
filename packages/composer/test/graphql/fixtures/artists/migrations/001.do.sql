
DROP TABLE IF EXISTS artists;

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER NOT NULL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  profession TEXT
);

INSERT INTO artists (id, first_name, last_name, profession) VALUES
(101, 'Christopher', 'Nolan', 'Director'),
(201, 'Luciano', 'Pavarotti', 'Singer'),
(301, 'Brian', 'Molko', 'Singer'),
(401, 'Bruce', 'Dickinson', 'Singer'),
(102, 'Roberto', 'Benigni', 'Director');

