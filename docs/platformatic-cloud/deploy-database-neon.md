# Deploy a PostgreSQL database with Neon

[Neon](https://neon.tech/) offers multi-cloud fully managed
Postgres with a generous free tier. They separated storage and
compute to offer autoscaling, branching, and bottomless storage.
It offers a great environment for creating database preview
environments for your [Platformatic DB](https://oss.platformatic.dev/docs/reference/db/introduction)
applications.

This guide shows you how to integrate Neon branch deployments with your
Platformatic app's GitHub Actions workflows. It assumes you have already
followed the [Quick Start Guide](/docs/quick-start-guide).

## Create a project on Neon

To set up an account with Neon, [open their website](https://neon.tech), sign up and create a
new project.

Take note of the following configuration setting values:

* The connection string for your `main` branch database, to be stored in a `NEON_DB_URL_PRODUCTION` secret
* The Project ID (available under the project **Settings**), to be stored in a `NEON_PROJECT_ID` secret
* Your API key (available by clicking on your user icon > **Account > Developer settings**), to be stored under `NEON_API_KEY`
* The username specified in your database connection string (available under project **Dashboard > Connection Details**), to be stored in a `DBUSER` secret
* The password specified in your database connection string (available under project **Dashboard > Connection Details**), to be stored in a `DBPASSWORD` secret

You can learn more about Neon API keys in their [Manage API Keys](https://neon.tech/docs/manage/api-keys) documentation.

## Configure Github Environments and Secrets

Now you need to set the configuration values listed above as
[repository secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
on your project's GitHub repository.
Learn how to use environments for deployment [in GitHub's documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment).

Configure the GitHub Environments for your repository to have:

* `production` secrets, available only to the `main` branch:
  - `NEON_DB_URL_PRODUCTION`
* `previews` secrets available to all branches:
  - `NEON_PROJECT_ID`
  - `NEON_API_KEY`
  - `DBUSER`
  - `DBPASSWORD`

## Configure the main branch workflow

Replace the contents of your app's workflow for static workspace deployment:

```yml title=".github/workflows/platformatic-static-workspace-deploy.yml"
name: Deploy Platformatic application to the cloud
on:
  push:
    branches:
      - main
    paths-ignore:
      - 'docs/**'
      - '**.md'

jobs:
  build_and_deploy:
    environment:
      name: production
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev
      - name: Deploy project
        uses: platformatic/onestep@latest
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          platformatic_workspace_id: <YOUR_STATIC_WORKSPACE_ID>
          platformatic_workspace_key: ${{ secrets.PLATFORMATIC_STATIC_WORKSPACE_API_KEY }}
          platformatic_config_path: ./platformatic.db.json
          secrets: DATABASE_URL
        env:
          DATABASE_URL: ${{ secrets.NEON_DB_URL_PRODUCTION }}
          PLT_SERVER_LOGGER_LEVEL: info 
          PORT: 3042 
          PLT_SERVER_HOSTNAME: 127.0.0.1
```

Replace `<YOUR_STATIC_WORKSPACE_ID>` with the workspace ID that you previously had in this file.

When your app is deployed to the static workspace it will now be configured to connect to the
`main` branch database for your Neon project.

## Configure the preview environment workflow

Neon allows up to 10 database branches on their free tier. You can automatically create a new
database branch when a pull request is opened, and then automatically remove it when the pull
request is merged.

### GitHub Action to create a preview environment

Replace the contents of your app's workflow for dynamic workspace deployment:

```yml title=".github/workflows/platformatic-dynamic-workspace-deploy.yml"
name: Deploy Platformatic application to the cloud
on:
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '**.md'

# This allows a subsequently queued workflow run to interrupt previous runs
concurrency:
  group: "${{ github.workflow }} @ ${{ github.event.pull_request.head.label || github.head_ref || github.ref }}"
  cancel-in-progress: true

jobs:
  build_and_deploy:
    environment:
      name: previews
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev
      - name: Get PR number
        id: get_pull_number
        run: |
          pull_sha=$(jq --raw-output .pull_request.base.sha "$GITHUB_EVENT_PATH")
          echo "pull_sha=${pull_sha}" >> $GITHUB_OUTPUT
          echo $pull_sha
      - uses: neondatabase/delete-branch-by-name-action@8260b587b411ffa0071bf68d0df2e37583aa719a
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          branch_name: ${{ steps.get_pull_number.outputs.pull_sha }}
          api_key: ${{ secrets.NEON_API_KEY }}
      - run: sleep 10
      - uses: neondatabase/create-branch-action@dc4ce9e0161722f64cedc66bb2aef72d556ccf7c
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          branch_name: ${{ steps.get_pull_number.outputs.pull_sha }}
          api_key: ${{ secrets.NEON_API_KEY }}
          username: ${{ secrets.DBUSER }}
          Password: ${{ secrets.DBPASSWORD }}
        id: create-branch
      - name: Get DATABASE_URL
        run: echo DATABASE_URL=${{ steps.create-branch.outputs.db_url}}/neondb
      - name: Deploy project
        uses: platformatic/onestep@latest
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          platformatic_workspace_id: <YOUR_DYNAMIC_WORKSPACE_ID>
          platformatic_workspace_key: ${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY }}
          platformatic_config_path: ./platformatic.db.json
        env:
          DATABASE_URL: ${{ steps.create-branch.outputs.db_url}}/neondb
          PLT_SERVER_LOGGER_LEVEL: info 
          PORT: 3042 
          PLT_SERVER_HOSTNAME: 127.0.0.1
```

Replace `<YOUR_DYNAMIC_WORKSPACE_ID>` with the workspace ID that you previously had in this file.

### Configure preview environment cleanup

After a pull request to the `main` branch is merged, you should remove the matching database branch.

Create a new file, `.github/workflows/cleanup-neon-branch-db.yml`, and copy and paste in the following
workflow configuration:

```yml title=".github/workflows/cleanup-neon-branch-db.yml"
name: Cleanup Neon branch database
on:
  push:
    branches:
      - 'main'
jobs:
  delete-branch:
    environment: 
      name: previews
    permissions: write-all
    runs-on: ubuntu-latest
    steps:
      - name: Get PR info
        id: get-pr-info
        uses: actions-ecosystem/action-get-merged-pull-request@v1.0.1
        with:
          github_token: ${{secrets.GITHUB_TOKEN}}

      - run: |
          echo ${{ steps.get-pr-info.outputs.number}}
      - name: Get last commit SHA
        id: get_sha
        run: |
          echo "sha=${{ github.event.before }}" >> $GITHUB_OUTPUT
      - name: Search branch by name
        id: get_branch_id
        run: |
          branch_id=$(curl --silent \
            "https://console.neon.tech/api/v2/projects/${PROJECT_ID}/branches" \
            --header "Accept: application/json" \
            --header "Content-Type: application/json" \
            --header "Authorization: Bearer ${API_KEY}" \
            | jq -r .branches \
            | jq -c '.[] | select(.name | contains("'${SHA}'")) .id' \
            | jq -r \
            ) \
            
          echo "branch_id=${branch_id}" >> $GITHUB_OUTPUT
        env:
          PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
          API_KEY: ${{ secrets.NEON_API_KEY }}
          SHA: ${{ steps.get_sha.outputs.sha }}
      - name: Delete Neon Branch
        uses: neondatabase/delete-branch-action@v2
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          branch_id: ${{ steps.get_branch_id.outputs.branch_id }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

<!-- A better setup might be possible by using different events, i.e. the one for the closed PR -->

## Deployment

To deploy these changes to your app:

1. Create a Git branch locally (`git checkout -b <BRANCH_NAME>`)
2. Commit your changes and push them to GitHub
3. Open a pull request on GitHub - a branch will automatically be created for your Neon database and a preview app will be deployed to Platformatic Cloud (in your app's dynamic workspace).
4. Merge the pull request - the Neon databsase branch will be automatically deleted and your app will be deployed to Platformatic Cloud (in your app's static workspace).