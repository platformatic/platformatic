
DROP TABLE IF EXISTS songs;

CREATE TABLE IF NOT EXISTS songs (
  id VARCHAR NOT NULL PRIMARY KEY,
  title VARCHAR NOT NULL,
  singer_id VARCHAR,
  year INT
);

INSERT INTO songs (id, title, singer_id, year) VALUES
('1', 'London Bridge is Falling Down ', '0', 1744),
('2', 'Nessun dorma', '201', 1992),
('3', 'Every you every me', '301', 1998),
('4', 'The bitter end', '301', 2003),
('5', 'Fear of the dark', 401, 1992),
('6', 'The trooper', '401', 1983),
('7', 'Vieni via con me', '102', 2012);
