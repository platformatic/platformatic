import NewApiProjectInstructions from '../getting-started/new-api-project-instructions.md';

# Dockerize a Platformatic App

This guide explains how to create a new Platformatic DB app, which connects to a PostgreSQL database.

We will then create a `docker-compose.yml` file that will run both services in separate containers 

## Generate a Platformatic DB App

<NewApiProjectInstructions/>

## Create Docker image for the Platformatic DB App

In this step you are going to create some files into the root project directory

- `.dockerignore` - This file tells Docker to ignore some files when copying the directory into the image filesystem

```
node_modules
.env*
```
- `start.sh` - This is our entrypoint. We will run migrations then start platformatic
```sh
#!/bin/sh

echo "Running migrations..." && \
npx platformatic db migrations apply && \
echo "Starting Platformatic App..." && \
npm start
```
:::info
Make sure you make this file executable with the command `chmod +x start.sh`
:::


- `Dockerfile` - This is the file Docker uses to create the image

```
FROM node:18-alpine
WORKDIR /usr/src/app
COPY . .
RUN npm install
COPY . .
EXPOSE 3042
CMD [ "./start.sh" ]
```

At this point you can build your Docker image with the command
```bash
$ docker build -t platformatic-app .
```

## Create Docker Compose config file

`docker-compose.yml` is the configuration file for `docker-compose` which will spin up containers for both PostgresSQL and our Platformatic App

```yml
version: "3.3"
services:
  postgresql:
    ports:
      - "5433:5432"
    image: "postgres:15-alpine"
    environment:
      - POSTGRES_PASSWORD=postgres
  platformatic:
    ports:
      - "3042:3042"
    image: 'platformatic-app:latest'
    depends_on:
      - postgresql
    links:
      - postgresql
    environment:
      PLT_SERVER_HOSTNAME: ${PLT_SERVER_HOSTNAME}
      PORT: ${PORT}
      PLT_SERVER_LOGGER_LEVEL: ${PLT_SERVER_LOGGER_LEVEL}
      DATABASE_URL: postgres://postgres:postgres@postgresql:5432/postgres
```

A couple of things to notice:
- The Platformatic app is started only once the database container is up and running (`depends_on`). 
- The Platformatic app is linked with `postgresql` service. Meaning that inside its container `ping postgresql` will be resolved with the internal ip of the database container.
- The environment is taken directly from the `.env` file created by the wizard

You can now run your containers with

```bash
$ docker-compose up # (-d if you want to send them in the background)
```

Everything should start smoothly, and you can access your app pointing your browser to `http://0.0.0.0:3042`

To stop the app you can either press `CTRL-C` if you are running them in the foreground, or, if you used the `-d` flag, run
```bash
$ docker-compose down
```

