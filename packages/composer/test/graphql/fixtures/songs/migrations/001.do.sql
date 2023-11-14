
DROP TABLE IF EXISTS songs;

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  singer_id INT,
  year INT
);

INSERT INTO songs (title, singer_id, year) VALUES
('London Bridge is Falling Down ', 0, 1744),
('Nessun dorma', 201, 1992),
('Every you every me', 301, 1998),
('The bitter end', 301, 2003),
('Fear of the dark', 401, 1992),
('The trooper', 401, 1983),
('Vieni via con me', 102, 2012);
