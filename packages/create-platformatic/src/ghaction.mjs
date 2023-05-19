import mkdirp from 'mkdirp'
import { join } from 'path'
import inquirer from 'inquirer'
import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'

export const dynamicWorkspaceGHTemplate = (env, config, buildTS = false) => {
  const envAsStr = Object.keys(env).reduce((acc, key) => {
    acc += `          ${key}: ${env[key]} \n`
    return acc
  }, '')

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
          platformatic_workspace_id: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_ID }}
          platformatic_workspace_key: \${{ secrets.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY }}
          platformatic_config_path: ${config}
        env:
${envAsStr}
`
}

export const staticWorkspaceGHTemplate = (env, config, buildTS = false) => {
  const envAsStr = Object.keys(env).reduce((acc, key) => {
    acc += `          ${key}: ${env[key]} \n`
    return acc
  }, '')

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
        env:
${envAsStr}
`
}

export const createDynamicWorkspaceGHAction = async (logger, env, config, projectDir, buildTS) => {
  const ghActionFileName = 'platformatic-dynamic-workspace-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  const isGithubActionExists = await isFileAccessible(ghActionFilePath)
  if (!isGithubActionExists) {
    await mkdirp(join(projectDir, '.github', 'workflows'))
    await writeFile(ghActionFilePath, dynamicWorkspaceGHTemplate(env, config, buildTS))
    logger.info('Github action successfully created, please add PLATFORMATIC_DYNAMIC_WORKSPACE_ID and PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY as repository secrets.')
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
      message: 'Do you want to create the github action to deploy this application to Platformatic Cloud dynamic workspace?',
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
    await mkdirp(join(projectDir, '.github', 'workflows'))
    await writeFile(ghActionFilePath, staticWorkspaceGHTemplate(env, config, buildTS))
    logger.info('Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_ID and PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
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
      message: 'Do you want to create the github action to deploy this application to Platformatic Cloud static workspace?',
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
