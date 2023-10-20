'use strict'

const { tmpdir, EOL } = require('os')
const { join, basename } = require('path')
const { createHash } = require('crypto')
const { readFile, access, mkdtemp, rm } = require('fs/promises')
const errors = require('./lib/errors')

const tar = require('tar')
const { request } = require('undici')

const ConfigManager = require('@platformatic/config')
const { compile, loadConfig } = require('@platformatic/runtime')

const makePrewarmRequest = require('./lib/prewarm.js')

async function archiveProject (pathToProject, archivePath) {
  const options = {
    gzip: false,
    file: archivePath,
    cwd: pathToProject,
    filter: (path, stat) => {
      if (basename(path) === '.env') {
        return false
      }
      return true
    }
  }
  return tar.create(options, ['.'])
}

class DeployClient {
  constructor ({
    deployServiceHost,
    workspaceId,
    workspaceKey,
    userApiKey
  }) {
    this.deployServiceHost = deployServiceHost
    this.workspaceId = workspaceId
    this.workspaceKey = workspaceKey || null
    this.userApiKey = userApiKey || null

    this.authHeaders = {
      'x-platformatic-workspace-id': workspaceId
    }
    if (workspaceKey) {
      this.authHeaders['x-platformatic-api-key'] = workspaceKey
    }
    if (userApiKey) {
      this.authHeaders['x-platformatic-user-api-key'] = userApiKey
    }
  }

  async createBundle (
    appType,
    configPath,
    checksum,
    size,
    githubMetadata
  ) {
    const url = this.deployServiceHost + '/bundles'

    const { statusCode, body } = await request(url, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'content-type': 'application/json',
        'accept-encoding': '*',
        accept: 'application/json'
      },
      body: JSON.stringify({
        ...githubMetadata,
        bundle: {
          appType,
          configPath,
          checksum,
          size
        }
      })
    })

    if (statusCode !== 200) {
      if (statusCode === 401) {
        throw new errors.InvalidPlatformaticWorkspaceKeyError()
      }
      throw new errors.CouldNotCreateBundleError(statusCode)
    }

    return body.json()
  }

  async uploadBundle (token, checksum, size, fileData) {
    const url = this.deployServiceHost + '/upload'
    const { statusCode } = await request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-tar',
        'Content-Length': size,
        'Content-MD5': checksum,
        authorization: `Bearer ${token}`
      },
      body: fileData,
      headersTimeout: 5 * 60 * 1000
    })

    if (statusCode !== 200) {
      throw new errors.FailedToUploadCodeArchiveError(statusCode)
    }
  }

  async createDeployment (token, label, metadata, variables, secrets) {
    const url = this.deployServiceHost + '/deployments'

    const { statusCode, body } = await request(url, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'content-type': 'application/json',
        'accept-encoding': '*',
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      },

      body: JSON.stringify({ label, metadata, variables, secrets })
    })

    if (statusCode !== 200) {
      if (statusCode === 401) {
        throw new errors.InvalidPlatformaticWorkspaceKeyError()
      }
      throw new errors.CouldNotCreateDeploymentError(statusCode)
    }

    return body.json()
  }
}

function generateMD5Hash (buffer) {
  return createHash('md5').update(buffer).digest('base64')
}

function parseEnvVariables (envVars) {
  const parsedEnvVars = {}
  for (let line of envVars.split(EOL)) {
    line = line.trim()
    if (line !== '' && !line.startsWith('#') && line.includes('=')) {
      const [key, value] = line.split('=')
      parsedEnvVars[key] = value
    }
  }
  return parsedEnvVars
}

async function getEnvFileVariables (envFilePath) {
  const isEnvFileAccessible = await isFileAccessible(envFilePath)
  if (!isEnvFileAccessible) return {}

  const dotEnvFile = await readFile(envFilePath, 'utf8')
  return parseEnvVariables(dotEnvFile)
}

async function isFileAccessible (path) {
  try {
    await access(path)
    return true
  } catch (err) {
    return false
  }
}

async function _loadConfig (minimistConfig, args) {
  try {
    return await loadConfig(minimistConfig, args)
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new errors.MissingConfigFileError()
    }
    /* c8 ignore next 2 */
    throw err
  }
}

async function deploy ({
  deployServiceHost,
  workspaceId,
  workspaceKey,
  userApiKey,
  label,
  pathToProject,
  pathToConfig,
  pathToEnvFile,
  pathToSecretsFile,
  secrets,
  variables,
  githubMetadata,
  compileTypescript,
  logger
}) {
  if (!workspaceId) {
    throw new Error('platformatic_workspace_id action param is required')
  }

  if (!workspaceKey && !userApiKey) {
    throw new Error('platformatic workspace key or user api key is required')
  }

  if (!pathToConfig) {
    pathToConfig = await ConfigManager.findConfigFile(pathToProject)
    if (!pathToConfig) {
      throw new Error('Could not find Platformatic config file')
    }
  }

  const args = ['-c', join(pathToProject, pathToConfig)]

  const { configManager, configType: appType } = await _loadConfig({}, args)
  const config = configManager.current

  logger.info(`Found Platformatic config file: ${pathToConfig}`)

  let compiled = false
  if (compileTypescript !== false) {
    try {
      compiled = await compile(args, logger)
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err
      }
      logger.trace('TypeScript compiler was not installed, skipping compilation')
    }
  }

  const deployClient = new DeployClient({
    deployServiceHost,
    workspaceId,
    workspaceKey,
    userApiKey
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-deploy-'))
  const bundlePath = join(tmpDir, 'project.tar')
  await archiveProject(pathToProject, bundlePath)
  logger.info('Project has been successfully archived')
  logger.trace({ bundlePath, tmpdir }, 'Temporary files')

  const bundle = await readFile(bundlePath)
  const bundleChecksum = generateMD5Hash(bundle)
  const bundleSize = bundle.length

  const { token, isBundleUploaded } = await deployClient.createBundle(
    appType,
    pathToConfig,
    bundleChecksum,
    bundleSize,
    githubMetadata
  )

  if (isBundleUploaded) {
    logger.info('Bundle has been already uploaded. Skipping upload...')
  } else {
    const { default: pretty } = await import('pretty-bytes')
    logger.info(`Uploading bundle (${pretty(bundleSize)}) to the cloud...`)
    await deployClient.uploadBundle(token, bundleChecksum, bundleSize, bundle)
    logger.info('Bundle has been successfully uploaded')
  }

  await rm(tmpDir, { recursive: true })

  const envFilePath = join(pathToProject, pathToEnvFile || '.env')
  const envFileVars = await getEnvFileVariables(envFilePath)
  const mergedEnvVars = { ...envFileVars, ...variables }

  if (compiled) {
    // By default, the platformatic config uses PLT_TYPESCRIPT to control typescript compilation
    // therefore, we are setting it to false to avoid running typescript compilation
    // on the server
    // TODO(mcollina) we should edit the configuration file on the fly and disable typescript compilation
    // without relying on the env variable
    mergedEnvVars.PLT_TYPESCRIPT = 'false'
  }

  const secretsFilePath = join(pathToProject, pathToSecretsFile || '.secrets.env')
  const secretsFromFile = await getEnvFileVariables(secretsFilePath)
  const mergedSecrets = { ...secretsFromFile, ...secrets }

  const appMetadata = { appType }
  if (appType === 'runtime') {
    const services = config.services.map(service => ({
      id: service.id,
      entrypoint: service.entrypoint
    }))
    appMetadata.services = services
  }

  const { id: deploymentId, entryPointUrl } = await deployClient.createDeployment(
    token,
    label,
    appMetadata,
    mergedEnvVars,
    mergedSecrets
  )
  logger.info('Application has been successfully deployed')
  logger.info('Starting application at ' + entryPointUrl)
  await makePrewarmRequest(entryPointUrl, logger)
  logger.info('Application has been successfully started')

  return {
    deploymentId,
    entryPointUrl
  }
}

module.exports = { deploy, errors }
