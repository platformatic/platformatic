import { join } from 'path'
import { isFileAccessible, safeMkdir } from './utils.mjs'
import { writeFile } from 'fs/promises'
import columnify from 'columnify'
function envAsString (env, indent) {
  const spaces = ' '.repeat(indent * 2)
  return Object.keys(env).reduce((acc, key) => {
    if (key.match('DATABASE_URL')) {
      acc += `${spaces}${key}: \${{ secrets.${key} }}\n`
    } else {
      acc += `${spaces}${key}: ${env[key]} \n`
    }

    return acc
  }, '')
}

function formatSecretsToAdd (secrets) {
  const output = columnify(secrets, {
    showHeaders: false,
    columnSplitter: ': ',
    config: {
      key: {
        align: 'right'
      },
      value: {
        align: 'left'
      }
    }
  })
  return output
}
export const dynamicWorkspaceGHTemplate = (env, config, buildTS = false) => {
  const envString = envAsString(env, 3)

  return `name: Deploy Platformatic application to the cloud
on:
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '**.md'
  workflow_dispatch:
    inputs:
      label:
        description: "Preview Label"
        required: true
        default: ""

jobs:
  build_and_deploy:
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    env:
${envString}
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev${buildTS
? `
      - name: Build project        
        run: npm run build`
: ''}
      - name: Deploy project
        id: deploy-project
        uses: platformatic/onestep@latest
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_workspace_id: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_ID }}
          platformatic_workspace_key: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY }}
          platformatic_config_path: ${config}
          label: \${{ github.event.inputs.label }}
    outputs:
      deployment_id: \${{ steps.deploy-project.outputs.deployment_id }}
  calculate_risk:
    permissions:
      contents: read
      pull-requests: write
    needs: build_and_deploy
    runs-on: ubuntu-latest
    steps:
      - name: Calculate risk
        uses: platformatic/onestep/actions/calculate-risk@latest
        if: github.event_name == 'pull_request'
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_workspace_id: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_ID }}
          platformatic_workspace_key: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY }}
          platformatic_deployment_id: \${{ needs.build_and_deploy.outputs.deployment_id }}
`
}

export const staticWorkspaceGHTemplate = (env, config, buildTS = false) => {
  const envString = envAsString(env, 3)

  return `name: Deploy Platformatic application to the cloud
on:
  push:
    branches:
      - main
    paths-ignore:
      - 'docs/**'
      - '**.md'
  workflow_dispatch:
    inputs:

jobs:
  build_and_deploy:
    permissions:
      contents: read
    runs-on: ubuntu-latest
    env:
${envString}
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev${buildTS
? `
      - name: Build project        
        run: npm run build`
: ''}
      - name: Deploy project
        uses: platformatic/onestep@latest
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_workspace_id: \${{ secrets.PLATFORMATIC_STATIC_WORKSPACE_ID }}
          platformatic_workspace_key: \${{ secrets.PLATFORMATIC_STATIC_WORKSPACE_API_KEY }}
          platformatic_config_path: ${config}
`
}

export const createDynamicWorkspaceGHAction = async (logger, env, config, projectDir, buildTS) => {
  const ghActionFileName = 'platformatic-dynamic-workspace-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  await safeMkdir(join(projectDir, '.github', 'workflows'), { recursive: true })
  await writeFile(ghActionFilePath, dynamicWorkspaceGHTemplate(env, config, buildTS))
  logger.info('PR Previews are enabled for your app and the Github action was successfully created, please add the following secrets as repository secrets: ')
  const envToBeAdded = { ...env }
  delete envToBeAdded.PORT
  const secretsString = formatSecretsToAdd({
    PLATFORMATIC_DYNAMIC_WORKSPACE_ID: 'your workspace id',
    PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY: 'your workspace API key',
    ...envToBeAdded
  })
  logger.info(`\n ${secretsString}`)
  const isGitDir = await isFileAccessible('.git', projectDir)
  if (!isGitDir) {
    logger.warn('No git repository found. The Github action won\'t be triggered.')
  }
}

export const createStaticWorkspaceGHAction = async (logger, env, config, projectDir, buildTS) => {
  const ghActionFileName = 'platformatic-static-workspace-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  await safeMkdir(join(projectDir, '.github', 'workflows'), { recursive: true })
  await writeFile(ghActionFilePath, staticWorkspaceGHTemplate(env, config, buildTS))
  logger.info('Github action successfully created, please add the following secrets as repository secrets: ')
  const envToBeAdded = { ...env }
  delete envToBeAdded.PORT
  const secretsString = formatSecretsToAdd({
    PLATFORMATIC_STATIC_WORKSPACE_ID: 'your workspace id',
    PLATFORMATIC_STATIC_WORKSPACE_API_KEY: 'your workspace API key',
    ...envToBeAdded
  })
  logger.info(`\n ${secretsString}`)
  const isGitDir = await isFileAccessible('.git', projectDir)
  if (!isGitDir) {
    logger.warn('No git repository found. The Github action won\'t be triggered.')
  }
}
