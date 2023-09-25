import { join } from 'path'
import inquirer from 'inquirer'
import { isFileAccessible } from './utils.mjs'
import { writeFile, mkdir } from 'fs/promises'
import columnify from 'columnify'
function envAsString (env, indent) {
  const spaces = Array(indent * 2).join(' ')
  return Object.keys(env).reduce((acc, key) => {
    if (key === 'DATABASE_URL') {
      acc += `${spaces}${key}: \${{ secrets.DATABASE_URL }}\n`
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
  const isGithubActionExists = await isFileAccessible(ghActionFilePath)
  if (!isGithubActionExists) {
    await mkdir(join(projectDir, '.github', 'workflows'), { recursive: true })
    await writeFile(ghActionFilePath, dynamicWorkspaceGHTemplate(env, config, buildTS))
    logger.info('PR Previews are enabled for your app and the Github action was successfully created, please add the following secrets as repository secrets: ')
    const secretsString = formatSecretsToAdd({
      PLATFORMATIC_DYNAMIC_WORKSPACE_ID: 'your workspace id',
      PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY: 'your workspace API key',
      DATABASE_URL: env.DATABASE_URL
    })
    logger.info(`\n ${secretsString}`)
    const isGitDir = await isFileAccessible('.git', projectDir)
    if (!isGitDir) {
      logger.warn('No git repository found. The Github action won\'t be triggered.')
    }
  } else {
    logger.info(`Github action file ${ghActionFilePath} found, skipping creation of github action file.`)
  }
}

/* c8 ignore next 21 */
export const askDynamicWorkspaceCreateGHAction = async (logger, env, type, buildTS, projectDir = process.cwd()) => {
  const { githubAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'githubAction',
      message: 'Do you want to enable PR Previews in your application?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }
  ])
  if (githubAction) {
    const config = `./platformatic.${type}.json`
    await createDynamicWorkspaceGHAction(logger, env, config, projectDir, buildTS)
  }
/* c8 ignore next */
}

export const createStaticWorkspaceGHAction = async (logger, env, config, projectDir, buildTS) => {
  const ghActionFileName = 'platformatic-static-workspace-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  const isGithubActionExists = await isFileAccessible(ghActionFilePath)
  if (!isGithubActionExists) {
    await mkdir(join(projectDir, '.github', 'workflows'), { recursive: true })
    await writeFile(ghActionFilePath, staticWorkspaceGHTemplate(env, config, buildTS))
    logger.info('Github action successfully created, please add the following secrets as repository secrets: ')
    const secretsString = formatSecretsToAdd({
      PLATFORMATIC_STATIC_WORKSPACE_ID: 'your workspace id',
      PLATFORMATIC_STATIC_WORKSPACE_API_KEY: 'your workspace API key',
      DATABASE_URL: env.DATABASE_URL
    })
    logger.info(`\n ${secretsString}`)
    const isGitDir = await isFileAccessible('.git', projectDir)
    if (!isGitDir) {
      logger.warn('No git repository found. The Github action won\'t be triggered.')
    }
  } else {
    logger.info(`Github action file ${ghActionFilePath} found, skipping creation of github action file.`)
  }
}

/* c8 ignore next 21 */
export const askStaticWorkspaceGHAction = async (logger, env, type, buildTS, projectDir = process.cwd()) => {
  const { githubAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'githubAction',
      message: 'Do you want to create the github action to deploy this application to Platformatic Cloud?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }
  ])
  if (githubAction) {
    const config = `./platformatic.${type}.json`
    await createStaticWorkspaceGHAction(logger, env, config, projectDir, buildTS)
  }
/* c8 ignore next */
}
