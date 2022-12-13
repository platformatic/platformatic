import mkdirp from 'mkdirp'
import { join } from 'path'
import inquirer from 'inquirer'
import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'

export const GITHUB_ACTION =
`name: Deploy Platformatic DB application to the cloud
on:
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '**.md'
jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout application project repository
        uses: actions/checkout@v3
      - name: npm install --omit=dev
        run: npm install --omit=dev
      - name: Deploy project
        uses: platformatic/onestep@latest
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_api_key: \${{ secrets.PLATFORMATIC_API_KEY }}
`

export const createGHAction = async (logger, projectDir) => {
  const ghActionFileName = 'platformatic-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  const isGithubActionExists = await isFileAccessible(ghActionFilePath)
  if (!isGithubActionExists) {
    await mkdirp(join(projectDir, '.github', 'workflows'))
    await writeFile(ghActionFilePath, GITHUB_ACTION)
    logger.info(`Github action file ${ghActionFilePath} successfully created.`)

    const isGitDir = await isFileAccessible('.git', projectDir)
    if (!isGitDir) {
      logger.warn('No git repository found. The Github action won\'t be triggered.')
    }
  } else {
    logger.info(`Github action file ${ghActionFilePath} found, skipping creation of github action file.`)
  }
}

/* c8 ignore next 12 */
export const askCreateGHAction = async (logger, projectDir = process.cwd()) => {
  const { githubAction } = await inquirer.prompt([{
    type: 'list',
    name: 'githubAction',
    message: 'Do you want to create the github action to deploy this application to Platformatic Cloud?',
    default: true,
    choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
  }])
  if (githubAction) {
    await createGHAction(logger, projectDir)
  }
}
