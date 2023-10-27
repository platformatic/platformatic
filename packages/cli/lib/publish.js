import pino from 'pino'
import pretty from 'pino-pretty'
import inquirer from 'inquirer'
import parseArgs from 'minimist'
import { request } from 'undici'
import { getUserApiKey } from '@platformatic/authenticate'
import errors from './errors.js'

export const PUBLISH_SERVICE_HOST = 'https://deploy.platformatic.cloud'

const logger = pino(pretty({
  translateTime: 'SYS:HH:MM:ss',
  ignore: 'hostname,pid'
}))

/* c8 ignore next 9 */
async function askForNpmPackageName () {
  const answer = await inquirer.prompt({
    type: 'input',
    name: 'npmPackageName',
    message: 'Enter platformatic stackable npm package name:'
  })

  return answer.npmPackageName
}

/* c8 ignore next 14 */
async function askToChooseOrg (orgs) {
  const orgsChoices = orgs.map((org) => {
    return { name: org.name, value: org.id }
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'orgId',
    message: 'Select organisation to publish to:',
    choices: orgsChoices
  })

  return answer.orgId
}

async function getUserOrgs (publishServiceHost, userApiKey) {
  const url = publishServiceHost + '/organisations'
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    }
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new errors.CouldNotFetchUserOrgsError(error)
  }

  const { orgs } = await body.json()
  return orgs
}

async function publishStackable (publishServiceHost, userApiKey, orgId, npmPackageName) {
  const url = publishServiceHost + '/publish'
  const { statusCode, body } = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    },
    body: JSON.stringify({ orgId, npmPackageName })
  })

  if (statusCode !== 200) {
    const error = await body.text()
    throw new errors.CouldNotPublishStackableError(error)
  }
}

export async function publish (argv) {
  try {
    const args = parseArgs(argv, {
      alias: {
        'org-name': 'o',
        'npm-package-name': 'n'
      },
      string: [
        'org-name',
        'npm-package-name',
        'plt-config',
        'publish-service-host'
      ],
      default: {
        'publish-service-host': PUBLISH_SERVICE_HOST,
        compileTypescript: true
      }
    })

    /* c8 ignore next 1 */
    const pltConfigPath = args['plt-config'] ?? null
    const publishServiceHost = args['publish-service-host']

    const orgName = args['org-name']
    let npmPackageName = args['npm-package-name']

    const userApiKey = await getUserApiKey(pltConfigPath)
    if (!userApiKey) {
      throw new errors.UserApiKeyNotFoundError()
    }

    const userOrgs = await getUserOrgs(publishServiceHost, userApiKey)
    if (userOrgs.length === 0) {
      throw new errors.NoUserOrgsError()
    }

    let orgId = null
    if (orgName) {
      const org = userOrgs.find((org) => org.name === orgName)
      if (!org) {
        throw new errors.OrgNotFoundError(orgName)
      }
      orgId = org.id
    } else {
      if (userOrgs.length === 1) {
        orgId = userOrgs[0].id
        /* c8 ignore next 3 */
      } else {
        orgId = await askToChooseOrg(userOrgs)
      }
    }

    /* c8 ignore next 3 */
    if (!npmPackageName) {
      npmPackageName = await askForNpmPackageName()
    }

    await publishStackable(publishServiceHost, userApiKey, orgId, npmPackageName)
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}
