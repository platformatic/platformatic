'use strict'

import { isAbsolute, dirname, relative, join } from 'path'
import { readFile } from 'fs/promises'

import { request } from 'undici'
import pino from 'pino'
import pretty from 'pino-pretty'
import dotenv from 'dotenv'
import inquirer from 'inquirer'
import parseArgs from 'minimist'
import deployClient from '@platformatic/deploy-client'
import { getUserApiKey } from '@platformatic/authenticate'
import errors from './errors.js'

export const DEPLOY_SERVICE_HOST = 'https://deploy.platformatic.cloud'

const WORKSPACE_TYPES = ['static', 'dynamic']
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const logger = pino(pretty({
  translateTime: 'SYS:HH:MM:ss',
  ignore: 'hostname,pid'
}))

async function askMissingWorkspaceDetails (
  workspaceType,
  workspaceId,
  workspaceKey,
  userApiKey
) {
  /* c8 ignore next 9 */
  if (!workspaceType) {
    const answer = await inquirer.prompt({
      type: 'list',
      name: 'workspaceType',
      message: 'Select workspace type:',
      choices: WORKSPACE_TYPES
    })
    workspaceType = answer.workspaceType
  }

  if (!WORKSPACE_TYPES.includes(workspaceType)) {
    throw new errors.InvalidWorkspaceTypeError(workspaceType, WORKSPACE_TYPES.join(', '))
  }

  /* c8 ignore next 8 */
  if (!workspaceId) {
    const answer = await inquirer.prompt({
      type: 'input',
      name: 'workspaceId',
      message: 'Enter workspace id:'
    })
    workspaceId = answer.workspaceId
  }

  if (!UUID_REGEX.test(workspaceId)) {
    throw new errors.InvalidWorkspaceIdError()
  }

  /* c8 ignore next 9 */
  if (!workspaceKey && !userApiKey) {
    const answer = await inquirer.prompt({
      type: 'password',
      name: 'workspaceKey',
      message: 'Enter workspace key:',
      mask: '*'
    })
    workspaceKey = answer.workspaceKey
  }

  return {
    workspaceType,
    workspaceId,
    workspaceKey
  }
}

/* c8 ignore next 26 */
async function askToChooseApplication (applications) {
  const applicationChoices = applications.map((application) => {
    return {
      name: application.name,
      value: application
    }
  })
  applicationChoices.push({
    name: 'Deploy to another application',
    value: null
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'application',
    message: 'Select application to deploy:',
    choices: applicationChoices
  })

  const chosenApplication = answer.application
  if (chosenApplication === null) {
    return null
  }

  return chosenApplication
}

/* c8 ignore next 27 */
async function askToChooseWorkspace (workspaces) {
  const workspaceChoices = workspaces.map((workspace) => {
    return {
      name: `${workspace.name} (${workspace.type})`,
      value: workspace
    }
  })
  workspaceChoices.push({
    name: 'Deploy to another workspace',
    value: null
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'workspace',
    message: 'Select workspace to deploy:',
    choices: workspaceChoices
  })

  const chosenWorkspace = answer.workspace
  if (chosenWorkspace === null) {
    return null
  }

  return chosenWorkspace
}

/* c8 ignore next 19 */
async function askToChooseDeployLabel (labels) {
  const entryPointChoices = labels.map((label) => {
    return { name: label, value: label }
  })
  entryPointChoices.push({
    name: 'Deploy to another label',
    value: null
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'entryPoint',
    message: 'Select entry point to deploy:',
    choices: entryPointChoices
  })

  return answer.entryPoint
}

/* c8 ignore next 10 */
async function askToEnterDeployLabel () {
  const answer = await inquirer.prompt({
    type: 'input',
    name: 'label',
    message: 'Enter deploy label:',
    default: 'cli:deploy-1'
  })
  return answer.label
}

async function readWorkspaceDetails (workspaceKeysPath) {
  /* c8 ignore next 3 */
  if (!isAbsolute(workspaceKeysPath)) {
    workspaceKeysPath = join(process.cwd(), workspaceKeysPath)
  }

  const workspaceFile = await readFile(workspaceKeysPath, 'utf8')
  const workspaceEnvVars = dotenv.parse(workspaceFile)

  if (
    workspaceEnvVars.PLATFORMATIC_DYNAMIC_WORKSPACE_ID &&
    workspaceEnvVars.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY
  ) {
    return {
      workspaceType: 'dynamic',
      workspaceId: workspaceEnvVars.PLATFORMATIC_DYNAMIC_WORKSPACE_ID,
      workspaceKey: workspaceEnvVars.PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY
    }
  }

  if (
    workspaceEnvVars.PLATFORMATIC_STATIC_WORKSPACE_ID &&
    workspaceEnvVars.PLATFORMATIC_STATIC_WORKSPACE_API_KEY
  ) {
    return {
      workspaceType: 'static',
      workspaceId: workspaceEnvVars.PLATFORMATIC_STATIC_WORKSPACE_ID,
      workspaceKey: workspaceEnvVars.PLATFORMATIC_STATIC_WORKSPACE_API_KEY
    }
  }

  throw new errors.CouldNotFindWorkspaceKeysError()
}

/* c8 ignore next 18 */
async function getUserApplications (deployServiceHost, userApiKey) {
  const { statusCode, body } = await request(`${deployServiceHost}/applications`, {
    headers: {
      'Content-Type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    }
  })

  if (statusCode !== 200) {
    const error = await body.text()
    console.error(error)
    throw new errors.CouldNotFetchUserApplicationsError()
  }

  const { applications } = await body.json()
  return applications
}

/* c8 ignore next 18 */
async function getWorkspaceLabels (deployServiceHost, workspaceId, userApiKey) {
  const { statusCode, body } = await request(`${deployServiceHost}/entrypoints`, {
    headers: {
      'Content-Type': 'application/json',
      'x-platformatic-workspace-id': workspaceId,
      'x-platformatic-user-api-key': userApiKey
    }
  })

  if (statusCode !== 200) {
    const error = await body.text()
    console.error(error)
    throw new errors.CouldNotFetchDeployLabelsError()
  }

  const { entryPoints } = await body.json()
  return entryPoints.map((entryPoint) => entryPoint.label)
}

/* c8 ignore next 19 */
async function getUserWorkspaceDetails (deployServiceHost, userApiKey) {
  const applications = await getUserApplications(deployServiceHost, userApiKey)
  if (applications.length === 0) return null

  const application = await askToChooseApplication(applications)
  if (application === null) return null

  const workspaces = application.workspaces
  if (workspaces.length === 0) return null

  const workspaceDetails = await askToChooseWorkspace(workspaces)
  if (workspaceDetails === null) return null

  return {
    workspaceType: workspaceDetails.type,
    workspaceId: workspaceDetails.id
  }
}

export async function deploy (argv) {
  try {
    const args = parseArgs(argv, {
      alias: {
        config: 'c',
        keys: 'k',
        type: 't',
        label: 'l',
        env: 'e',
        secrets: 's',
        compileTypescript: ['compile', 'C']
      },
      boolean: ['compileTypescript'],
      string: [
        'type',
        'label',
        'workspace-id',
        'workspace-key',
        'env',
        'secrets',
        'deploy-service-host'
      ],
      default: {
        'deploy-service-host': DEPLOY_SERVICE_HOST,
        compileTypescript: true
      }
    })

    const deployServiceHost = args['deploy-service-host']

    let workspaceId = args['workspace-id']
    let workspaceType = args.type

    let workspaceKey = args['workspace-key']
    let userApiKey = null

    if (!workspaceId) {
      if (args.keys) {
        const workspaceDetails = await readWorkspaceDetails(args.keys)
        workspaceId = workspaceDetails.workspaceId
        workspaceType = workspaceDetails.workspaceType
        workspaceKey = workspaceDetails.workspaceKey
      /* c8 ignore next 10 */
      } else {
        userApiKey = await getUserApiKey()
        if (userApiKey) {
          const workspaceDetails = await getUserWorkspaceDetails(deployServiceHost, userApiKey)
          if (workspaceDetails) {
            workspaceId = workspaceDetails.workspaceId
            workspaceType = workspaceDetails.workspaceType
          }
        }
      }
    }

    const workspaceDetails = await askMissingWorkspaceDetails(
      workspaceType,
      workspaceId,
      workspaceKey,
      userApiKey
    )
    workspaceId = workspaceDetails.workspaceId
    workspaceType = workspaceDetails.workspaceType
    workspaceKey = workspaceDetails.workspaceKey

    let label = args.label

    if (workspaceType === 'dynamic') {
      /* c8 ignore next 17 */
      if (!label) {
        userApiKey = userApiKey || await getUserApiKey()

        if (userApiKey) {
          const workspaceLabels = await getWorkspaceLabels(
            deployServiceHost,
            workspaceId,
            userApiKey
          )
          if (workspaceLabels.length !== 0) {
            label = await askToChooseDeployLabel(workspaceLabels)
          }
        }
        if (!label) {
          label = await askToEnterDeployLabel()
        }
      }

      const labelPrefix = label.split(':')[0]
      const labelPrefixes = ['cli', 'github-pr']
      if (!labelPrefix || !labelPrefixes.includes(labelPrefix)) {
        label = `cli:${label}`
      }
    }

    let pathToConfig = args.config
    let pathToProject = process.cwd()

    if (pathToConfig && isAbsolute(pathToConfig)) {
      pathToProject = dirname(pathToConfig)
      pathToConfig = relative(pathToProject, pathToConfig)
    }

    const pathToEnvFile = args.env || '.env'
    const pathToSecretsFile = args.secrets || '.secrets.env'

    await deployClient.deploy({
      deployServiceHost,
      workspaceId,
      workspaceKey,
      userApiKey,
      pathToProject,
      pathToConfig,
      pathToEnvFile,
      pathToSecretsFile,
      secrets: {},
      variables: {},
      label,
      logger
    })
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}
