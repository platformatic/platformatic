
DROP TABLE IF EXISTS movies;

CREATE TABLE IF NOT EXISTS movies (
  id VARCHAR NOT NULL PRIMARY KEY,
  title VARCHAR NOT NULL,
  director_id VARCHAR,
  year INT
);

INSERT INTO movies (id, title, director_id, year) VALUES
('1', 'Following', '101', 1998),
('2', 'Memento', '101', 2000),
('3', 'Insomnia', '101', 2002),
('4', 'Batman Begins', '101',  2005),
('5', 'The Prestige', '101',  2006),
('6', 'The Dark Knight', '101',  2008),
('7', 'Inception', '101', 2010),
('8', 'The Dark Knight Rises', '101',  2012),
('9', 'Interstellar', '101', 2014),
('10', 'Dunkirk', '101', 2017),
('11', 'Tenet', '101', 2020),
('12', 'Oppenheimer', '101', 2023),
('13', 'La vita é bella', '102', 1997);
