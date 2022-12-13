import { request } from 'undici'
import mkdirp from 'mkdirp'
import { join } from 'path'
import inquirer from 'inquirer'
import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'

export const getOneStepVersion = async () => {
  try {
    // We try to get latest version from GitHub API, but if not present (lke now) we fallback to tags
    const { statusCode, body } = await request('https://api.github.com/repos/platformatic/onestep/releases/latest', {
      headers: {
        // Reason: https://docs.github.com/en/rest/overview/resources-in-the-rest-api?apiVersion=2022-11-28#user-agent-required
        'user-agent': 'platformatic/platformatic'
      }
    })

    if (statusCode === 404) {
      // if not releases are found, we use the latest version tag
      const { body } = await request('https://api.github.com/repos/platformatic/onestep/tags', {
        headers: {
          'user-agent': 'platformatic/platformatic'
        }
      })
      const tags = await body.json()
      if (tags?.length > 0) {
        const version = tags[0]?.name
        return version
      }
    }

    if (statusCode === 403) {
      // if we are rate limited
      return 'CHANGE-ME-TO-LATEST-VERSION'
    }

    const bodyJson = await body.json()
    const { version } = bodyJson
    return version
  } catch (err) {
    // If for any reason we can't get the latest version dynamically, we fallback to a CHANGEME string
    return 'CHANGE-ME-TO-LATEST-VERSION'
  }
}

export const getGHAction = async () => {
  const onestepVersion = await getOneStepVersion()
  const ghActionConfig =
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
        uses: platformatic/onestep@${onestepVersion}
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          platformatic_api_key: \${{ secrets.PLATFORMATIC_API_KEY }}
  `
  return ghActionConfig
}

export const createGHAction = async (logger, projectDir) => {
  const ghActionFileName = 'platformatic-deploy.yml'
  const ghActionFilePath = join(projectDir, '.github', 'workflows', ghActionFileName)
  const isGithubActionExists = await isFileAccessible(ghActionFilePath)
  if (!isGithubActionExists) {
    await mkdirp(join(projectDir, '.github', 'workflows'))
    const githubAction = await getGHAction()
    await writeFile(ghActionFilePath, githubAction)
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
