
DROP TABLE IF EXISTS movies;

CREATE TABLE IF NOT EXISTS movies (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  director_id INT,
  year INT
);

INSERT INTO movies (title, director_id, year) VALUES
('Following', 101, 1998),
('Memento', 101, 2000),
('Insomnia', 101, 2002),
('Batman Begins', 101,  2005),
('The Prestige', 101,  2006),
('The Dark Knight', 101,  2008),
('Inception', 101, 2010),
('The Dark Knight Rises', 101,  2012),
('Interstellar', 101, 2014),
('Dunkirk', 101, 2017),
('Tenet', 101, 2020),
('Oppenheimer', 101, 2023),
('La vita é bella', 102, 1997);
