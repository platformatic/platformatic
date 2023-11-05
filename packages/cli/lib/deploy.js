'use strict'

import { isAbsolute, dirname, relative, join } from 'path'
import { readFile } from 'fs/promises'

import { request } from 'undici'
import { bold, green } from 'colorette'
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

const CREATE_NEW_WORKSPACE_CHOICE = Symbol('CREATE_NEW_WORKSPACE_CHOICE')
const CREATE_NEW_APPLICATION_CHOICE = Symbol('CREATE_NEW_APPLICATION_CHOICE')

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

/* c8 ignore next 27 */
async function askToChooseApplication (applications) {
  const applicationChoices = applications.map((application) => {
    return {
      name: application.name,
      value: application
    }
  })
  applicationChoices.push({
    name: bold('Create new application'),
    value: CREATE_NEW_APPLICATION_CHOICE
  })
  applicationChoices.push({
    name: bold('Deploy to another application'),
    value: null
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'application',
    message: 'Select application to deploy:',
    choices: applicationChoices,
    loop: false
  })

  const chosenApplication = answer.application
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
    name: bold('Create new workspace'),
    value: CREATE_NEW_WORKSPACE_CHOICE
  })
  workspaceChoices.push({
    name: bold('Deploy to another workspace'),
    value: null
  })

  const answer = await inquirer.prompt({
    type: 'list',
    name: 'workspace',
    message: 'Select workspace to deploy:',
    choices: workspaceChoices,
    loop: false
  })

  const chosenWorkspace = answer.workspace
  return chosenWorkspace
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

/* c8 ignore next 21 */
async function askNewWorkspaceDetails () {
  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'workspaceName',
      message: 'Enter workspace name:'
    },
    {
      type: 'list',
      name: 'workspaceType',
      message: 'Select workspace type:',
      choices: WORKSPACE_TYPES
    }
  ])

  return {
    workspaceName: answer.workspaceName,
    workspaceType: answer.workspaceType
  }
}

/* c8 ignore next 12 */
async function askNewApplicationDetails () {
  const answer = await inquirer.prompt({
    type: 'input',
    name: 'applicationName',
    message: 'Enter application name:'
  })

  return {
    applicationName: answer.applicationName
  }
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
async function getUserOrgs (deployServiceHost, userApiKey) {
  const url = deployServiceHost + '/organisations'
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    }
  })

  if (statusCode !== 200) {
    throw new errors.CouldNotFetchUserOrgsError()
  }

  const { orgs } = await body.json()
  return orgs
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

/* c8 ignore next 30 */
async function createWorkspace (
  deployServiceHost,
  userApiKey,
  appId,
  workspaceName,
  workspaceType
) {
  const { statusCode, body } = await request(`${deployServiceHost}/workspaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    },
    body: JSON.stringify({
      appId,
      name: workspaceName,
      type: workspaceType
    })
  })

  if (statusCode !== 200) {
    const error = await body.text()
    console.error(error)
    throw new errors.CouldNotCreateWorkspaceError()
  }

  const { id: workspaceId } = await body.json()
  return workspaceId
}

/* c8 ignore next 25 */
async function createApplication (
  deployServiceHost,
  userApiKey,
  orgId,
  applicationName
) {
  const { statusCode, body } = await request(`${deployServiceHost}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-platformatic-user-api-key': userApiKey
    },
    body: JSON.stringify({ orgId, name: applicationName })
  })

  if (statusCode !== 200) {
    const error = await body.text()
    console.error(error)
    throw new errors.CouldNotCreateApplicationError()
  }

  const { id: applicationId } = await body.json()
  return applicationId
}

/* c8 ignore next 16 */
async function getUserOrgDetails (deployServiceHost, userApiKey) {
  const userOrgs = await getUserOrgs(deployServiceHost, userApiKey)
  if (userOrgs.length === 0) {
    throw new errors.NoUserOrgsError()
  }

  let orgId = null
  if (userOrgs.length === 1) {
    orgId = userOrgs[0].id
  } else {
    orgId = await askToChooseOrg(userOrgs)
  }

  return { id: orgId }
}

/* c8 ignore next 26 */
async function getUserApplicationDetails (deployServiceHost, userApiKey) {
  const applications = await getUserApplications(deployServiceHost, userApiKey)
  if (applications.length === 0) return null

  const application = await askToChooseApplication(applications)
  if (application === null) return null

  if (application === CREATE_NEW_APPLICATION_CHOICE) {
    const { id: orgId } = await getUserOrgDetails(deployServiceHost, userApiKey)
    const { applicationName } = await askNewApplicationDetails()
    const applicationId = await createApplication(
      deployServiceHost,
      userApiKey,
      orgId,
      applicationName
    )
    return { id: applicationId, name: applicationName, workspaces: [] }
  }
  return {
    id: application.id,
    name: application.name,
    workspaces: application.workspaces
  }
}

/* c8 ignore next 24 */
async function getUserWorkspaceDetails (deployServiceHost, userApiKey) {
  const application = await getUserApplicationDetails(deployServiceHost, userApiKey)
  if (application === null) return null

  const workspaceDetails = await askToChooseWorkspace(application.workspaces)
  if (workspaceDetails === null) return null

  if (workspaceDetails === CREATE_NEW_WORKSPACE_CHOICE) {
    const { workspaceName, workspaceType } = await askNewWorkspaceDetails()
    const workspaceId = await createWorkspace(
      deployServiceHost,
      userApiKey,
      application.id,
      workspaceName,
      workspaceType
    )
    return { workspaceId, workspaceType }
  }

  return {
    workspaceId: workspaceDetails.id,
    workspaceType: workspaceDetails.type
  }
}

export async function deploy (argv) {
  console.log('This application will be deployed to ' + bold(green('Platformatic Cloud')) + '. To change the target use the --deploy-service-host flag')
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
        userApiKey = await getUserApiKey().catch(() => {})
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
        userApiKey = userApiKey || await getUserApiKey().catch(() => {})

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
