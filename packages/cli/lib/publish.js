import pino from 'pino'
import pretty from 'pino-pretty'
import inquirer from 'inquirer'
import parseArgs from 'minimist'
import { request } from 'undici'
import { getUserApiKey } from '@platformatic/authenticate'

export const PUBLISH_SERVICE_HOST = 'https://deploy.platformatic.cloud'

const logger = pino(pretty({
  translateTime: 'SYS:HH:MM:ss',
  ignore: 'hostname,pid'
}))

async function askForNpmPackageName () {
  const answer = await inquirer.prompt({
    type: 'input',
    name: 'npmPackageName',
    message: 'Enter npm package name:'
  })

  return answer.npmPackageName
}

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
    // throw new errors.UnableToContactLoginServiceError()
  }

  return body.json()
}

async function publishStackable (publishServiceHost, userApiKey, orgId, npmPackageName) {
  console.log('Publishing stackable...')
  console.log(publishServiceHost, userApiKey, orgId, npmPackageName)
}

export async function publish (argv) {
  try {
    const args = parseArgs(argv, {
      alias: {
        'org-id': 'o',
        'npm-package-name': 'npm'
      },
      string: [
        'org-id',
        'npm-package-name',
        'publish-service-host'
      ],
      default: {
        'publish-service-host': PUBLISH_SERVICE_HOST,
        compileTypescript: true
      }
    })

    const publishServiceHost = args['publish-service-host']

    let orgId = args['org-id']
    let npmPackageName = args['npm-package-name']
    let userApiKey = null

    if (!orgId) {
      userApiKey = await getUserApiKey()
      const userOrgs = await getUserOrgs(publishServiceHost, userApiKey)
      orgId = await askToChooseOrg(userOrgs)
    }

    if (!npmPackageName) {
      npmPackageName = await askForNpmPackageName()
    }

    await publishStackable(
      publishServiceHost,
      userApiKey,
      orgId,
      npmPackageName
    )
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}
