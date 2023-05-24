'use strict'

const { tmpdir, EOL } = require('os')
const { join } = require('path')
const { createHash } = require('crypto')
const { readFile, access, mkdtemp, rm } = require('fs/promises')

const tar = require('tar')
const { request } = require('undici')

const ConfigManager = require('@platformatic/config')
const { getConfigType } = require('@platformatic/start')

const makePrewarmRequest = require('./lib/prewarm.js')

async function archiveProject (pathToProject, archivePath) {
  const options = { gzip: false, file: archivePath, cwd: pathToProject }
  return tar.create(options, ['.'])
}

class DeployClient {
  constructor (deployServiceHost, workspaceId, workspaceKey) {
    this.deployServiceHost = deployServiceHost
    this.workspaceId = workspaceId
    this.workspaceKey = workspaceKey
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
        'x-platformatic-workspace-id': this.workspaceId,
        'x-platformatic-api-key': this.workspaceKey,
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
        throw new Error('Invalid platformatic_workspace_key provided')
      }
      throw new Error(`Could not create a bundle: ${statusCode}`)
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
      throw new Error(`Failed to upload code archive: ${statusCode}`)
    }
  }

  async createDeployment (token, label, variables, secrets) {
    const url = this.deployServiceHost + '/deployments'

    const { statusCode, body } = await request(url, {
      method: 'POST',
      headers: {
        'x-platformatic-workspace-id': this.workspaceId,
        'x-platformatic-api-key': this.workspaceKey,
        'content-type': 'application/json',
        'accept-encoding': '*',
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      },

      body: JSON.stringify({ label, variables, secrets })
    })

    if (statusCode !== 200) {
      if (statusCode === 401) {
        throw new Error('Invalid platformatic_workspace_key provided')
      }
      throw new Error(`Could not create a deployment: ${statusCode}`)
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

async function checkPlatformaticDependency (logger, projectPath) {
  const packageJsonPath = join(projectPath, 'package.json')
  const packageJsonExist = await isFileAccessible(packageJsonPath)
  if (!packageJsonExist) return

  const packageJsonData = await readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(packageJsonData)

  const dependencies = packageJson.dependencies
  if (
    dependencies !== undefined &&
    dependencies.platformatic !== undefined
  ) {
    logger.warn('Move platformatic dependency to devDependencies to speed up deployment')
  }
}

async function deploy ({
  deployServiceHost,
  workspaceId,
  workspaceKey,
  label,
  pathToProject,
  pathToConfig,
  pathToEnvFile,
  pathToSecretsFile,
  secrets,
  variables,
  githubMetadata,
  logger
}) {
  if (!workspaceId) {
    throw new Error('platformatic_workspace_id action param is required')
  }

  if (!workspaceKey) {
    throw new Error('platformatic_workspace_key action param is required')
  }

  await checkPlatformaticDependency(logger, pathToProject)

  if (!pathToConfig) {
    pathToConfig = await ConfigManager.findConfigFile(pathToProject)
    if (!pathToConfig) {
      throw new Error('Could not find Platformatic config file')
    }
  }

  const args = ['-c', join(pathToProject, pathToConfig)]
  const appType = await getConfigType(args, pathToProject)

  logger.info(`Found Platformatic config file: ${pathToConfig}`)

  const deployClient = new DeployClient(
    deployServiceHost,
    workspaceId,
    workspaceKey
  )

  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-deploy-'))
  const bundlePath = join(tmpDir, 'project.tar')
  await archiveProject(pathToProject, bundlePath)
  logger.info('Project has been successfully archived')

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
    logger.info('Uploading bundle to the cloud...')
    await deployClient.uploadBundle(token, bundleChecksum, bundleSize, bundle)
    logger.info('Bundle has been successfully uploaded')
  }

  await rm(tmpDir, { recursive: true })

  const envFilePath = join(pathToProject, pathToEnvFile || '.env')
  const envFileVars = await getEnvFileVariables(envFilePath)
  const mergedEnvVars = { ...envFileVars, ...variables }

  const secretsFilePath = join(pathToProject, pathToSecretsFile || '.secrets.env')
  const secretsFromFile = await getEnvFileVariables(secretsFilePath)
  const mergedSecrets = { ...secretsFromFile, ...secrets }

  const { entryPointUrl } = await deployClient.createDeployment(
    token,
    label,
    mergedEnvVars,
    mergedSecrets
  )
  logger.info('Application has been successfully deployed')
  logger.info('Starting application at ' + entryPointUrl)
  await makePrewarmRequest(entryPointUrl, logger)
  logger.info('Application has been successfully started')

  return entryPointUrl
}

module.exports = { deploy }
