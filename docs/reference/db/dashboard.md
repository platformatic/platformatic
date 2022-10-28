# Platformatic DB Dashboard

The Platformatic DB has a dashboard used to do several actions like see the current configuration and access documentation for your generated API.

It also integrates GraphiQL, to run queries and mutations against Platformatic DB Server.

## Development Server

If you want to contribute on the dashboard, it needs to know where is Platformatic DB Server.

Create a `./packages/db-dashboard/.env` file with the following content
```
VITE_SERVER_URL=http://localhost:3042
```

Or whatever port you are running platformatic DB server on. 

Then run 
```sh
pnpm run dashboard:start
```

You'll get vite's development server up and running.

## Build

Just run 
```sh
pnpm run dashboard:build
```

And `vite` will create a production ready bundle that will be served by Platformatic DB.

