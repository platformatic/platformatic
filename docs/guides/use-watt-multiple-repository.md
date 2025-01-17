# Using Watt for Multi-Repository Service 

This guide explains how to use [Watt](https://platformatic.dev/watt) to resolve and manage services from different `git` repositories, build and start your application. You'll learn how to set up, configure, and run a Watt application with multi-repository service resolution.

## Prerequisites

Before beginning, ensure you have installed:

- [Node.js](https://nodejs.org/en) (v20.16.0+ or v22.3.0+)
- [npm](https://www.npmjs.com/package/npm) (v10 or higher)
- A code editor (e.g., [Visual Studio Code](https://code.visualstudio.com))

## Project Setup

### Creating Your Watt Application

To create a new Watt application, please refer to our [Watt setup guide](https://www.notion.so/Using-Watt-for-Multi-Repository-Service-Resolution-17b60f428d7e800cbcc3efd396732732?pvs=21).

### Adding Service Resolution

By default, the `wattpm resolve` command isn't included in your Watt application's package.json. You have two options to use it:

1. Run directly via CLI:

```sh
npx wattpm resolve {repository name and directory path}
```

2. Add it to your `package.json`:

```json
{
  "name": "with-resolve",
  "private": true,
  "scripts": {
    "dev": "wattpm dev",
    "resolve": "wattpm resolve",
    "build": "wattpm build",
    "start": "wattpm start"
  },
  "dependencies": {
    "@platformatic/runtime": "2.21.0",
    "@platformatic/next": "2.21.0",
    "@platformatic/node": "2.21.0",
    "wattpm": "2.21.0"
  },
  "devDependencies": {
    "platformatic": "2.21.0"
  },
  "workspaces": [
    "web/*",
    "external/*"
  ]
}
```

## Working with Services

### Resolving Services

To resolve services located in the web folder of your Watt application, run the below command:

```sh
npm run resolve
```

This command fetches and unifies all required services.

### Building the Application

```sh
npm run build
```

This command builds the application with all resolved services.

### Starting the Application

Run the command below to start your application in development mode:

```sh
npm run dev
```

To run your application in production mode, run the command below:

```sh
npm start 
```

## Local Development Configuration

Watt provides flexible options for service resolution during local development. You can configure services to resolve from local directories instead of Git repositories.

### Environment Variables

Configure local development using these environment variables:

- `PLT_NODE_PATH`: Specifies local Node.js service directories
- `PLT_NEXT_PATH`: Specifies local Next.js service directories

Example configuration:

```sh
export PLT_NODE_PATH=/path/to/local/service
export PLT_NEXT_PATH=/path/to/local/nextjs/service
```

## Additional Resources

- [wattpm-resolve sample application](https://github.com/platformatic/wattpm-resolve)
- [Watt Setup Guide](https://docs.platformatic.dev/docs/getting-started/quick-start-watt)