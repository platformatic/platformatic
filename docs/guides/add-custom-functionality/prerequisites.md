# Prerequisites

In the following examples we assume you already
- cloned `platformatic/platformatic` repo from Github
- ran `pnpm install` to install all dependencies
- have [Docker](https://docker.io) and [`docker-compose`](https://docs.docker.com/compose/install/) installed and running on your machine

## Config File

Create a `platformatic.db.json` file in the root project, it will be loaded automatically by Platformatic (no need of `-c, --config` flag).

```json
{
  "server": {
    "hostname": "127.0.0.1",
    "port": 3042,
    "logger": {
      "level": "info"
    }
  },
  "db": {
    "connectionString": "postgres://postgres:postgres@127.0.0.1/postgres"
  },
  "migrations": {
    "dir": "./migrations",
    "table": "versions"
  },
  "plugins": {
    "paths": ["plugin.js"]
  }
}
```

- Once Platformatic DB starts, its API will be available at `http://127.0.0.1:3042`
- It will connect and read the schema from a PostgreSQL DB
- Will read migrations from `./migrations` directory
- Will load custom functionallity from `./plugin.js` file.
## Database and Migrations

Start the database using the sample `docker-compose.yml` file.

```
$ docker-compose up -d postgresql
```

For migrations create a `./migrations` directory and a `001.do.sql` file with following contents

```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL
);
INSERT INTO pages (title, body) VALUES ('First Page', 'This is the first sample page');
INSERT INTO pages (title, body) VALUES ('Second Page', 'This is the second sample page');
INSERT INTO pages (title, body) VALUES ('Third Page', 'This is the third sample page');
```

## Plugin

Copy and paste this boilerplate code into `./plugin.js` file. We will fill this in the examples.
```js
'use strict'

module.exports = async (app, opts) {
  // we will fill this later
}
```

## Start the server

Run

```
$ platformatic db start
```

You will get an output similar to this

```
                           /////////////
                        /////         /////
                      ///                 ///
                    ///                     ///
                   ///                       ///
               &&  ///                       ///  &&
          &&&&&&   ///                       ///   &&&&&&
        &&&&       ///                      ///        &&&&
      &&&          ///                     ///            &&&&&&&&&&&&
     &&&           ///     ///////      ////               &&       &&&&&
     &&            ///    ///////////////                               &&&
    &&&            ///     ///                                           &&&
     &&&           ///      //                                            &&
     &&&           ///                                                    &&
       &&&         ///                                                   &&&
         &&&&      ///                                                 &&&
            &&&&&% ///  &&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
                   ///
                   ///
                   ///
                   ///
                   ///
                   ///

[11:19:46.562] INFO (65122): running 001.do.sql
[11:19:46.929] INFO (65122): server listening
    url: "http://127.0.0.1:3042"
```

Now is possible to create some examples, like [extend GraphQL Schema](./extend-graphql), [extend REST API](./extend-rest)
