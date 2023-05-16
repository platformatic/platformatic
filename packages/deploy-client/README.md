Deploys code to the Platformatic cloud.

### Install
  
```bash
npm install @platformatic/deploy-client
```

### API

#### deploy(options)

**Options:** 
- **deployServiceHost** - The host of the Platformatic cloud deploy service. Use `'https://plt-production-deploy-service.fly.dev'`.

- **workspaceId** - The id of the workspace to deploy to.

- **workspaceKey** - The key of the workspace to deploy to.

- **label** - The label of the deployment. Use it if you want to deploy application to the dynamic workspace.

- **pathToProject** - The path to the root of the project to deploy.

- **pathToConfig** - The path to the Platformatic app config file.

- **pathToEnvFile** - The path to the .env file.

- **pathToSecretsFile** - The path to the .secrets.env file.

- **secrets** - The secrets to pass to the Platformatic app. If there is a .secrets.env file

- **variables** - The variables to pass to the Platformatic app. If there is a .env file

- **githubMetadata** - The metadata about the github repository, branch, commit and PR (if it's a dynamic workspace).

- **logger** - The logger to use. Use pino or other logger with the same interface.
