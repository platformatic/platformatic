#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join, dirname, relative, resolve, posix } from 'path'
import * as desm from 'desm'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'
import { processGraphQL } from './lib/gen-graphql.mjs'
import { ConfigManager, loadConfig } from '@platformatic/config'
import { analyze, write } from '@platformatic/metaconfig'
import graphql from 'graphql'
import { appendToBothEnvs } from './lib/utils.mjs'
import { RuntimeApi, platformaticRuntime } from '@platformatic/runtime'
import { findUp } from 'find-up'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import YAML from 'yaml'

function parseFile (content) {
  let parsed = false
  const toTry = [JSON.parse, YAML.parse]
  for (const fn of toTry) {
    try {
      parsed = fn(content)
    } catch (err) {
      // do nothing
    }
  }
  return parsed
}
async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

const configFileNames = ConfigManager.listConfigFiles()

async function writeOpenAPIClient (folder, name, text, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders) {
  await mkdir(folder, { recursive: true })

  // TODO deal with yaml
  const schema = parseFile(text)
  if (!schema) {
    throw new Error('Cannot parse OpenAPI file. Please make sure is a JSON or a YAML file.')
  }
  if (!typesOnly) {
    await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
  }
  const { types, implementation } = processOpenAPI({ schema, name, fullResponse, fullRequest, optionalHeaders })
  await writeFile(join(folder, `${name}.d.ts`), types)
  if (generateImplementation) {
    await writeFile(join(folder, `${name}.cjs`), implementation)
  }

  if (!typesOnly) {
    await writeFile(join(folder, 'package.json'), getPackageJSON({ name, generateImplementation }))
  }
}

async function writeGraphQLClient (folder, name, schema, url, generateImplementation) {
  await mkdir(folder, { recursive: true })
  const { types, implementation } = processGraphQL({ schema, name, folder, url })
  const clientSchema = graphql.buildClientSchema(schema)
  const sdl = graphql.printSchema(clientSchema)
  await writeFile(join(folder, `${name}.schema.graphql`), sdl)
  await writeFile(join(folder, `${name}.d.ts`), types)
  if (generateImplementation) {
    await writeFile(join(folder, `${name}.cjs`), implementation)
  }
  await writeFile(join(folder, 'package.json'), getPackageJSON({ name, generateImplementation }))
}

async function downloadAndWriteOpenAPI (logger, url, folder, name, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders) {
  logger.debug(`Trying to download OpenAPI schema from ${url}`)
  const res = await request(url)
  if (res.statusCode === 200) {
    // we are OpenAPI
    const text = await res.body.text()
    try {
      await writeOpenAPIClient(folder, name, text, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders)
      /* c8 ignore next 3 */
    } catch (err) {
      logger.error(err)
      return false
    }
    return 'openapi'
  }
  res.body.resume()

  return false
}

async function downloadAndWriteGraphQL (logger, url, folder, name, generateImplementation) {
  logger.debug(`Trying to download GraphQL schema from ${url}`)
  const query = graphql.getIntrospectionQuery()
  const res = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query
    })
  })

  const text = await res.body.text()

  if (res.statusCode !== 200) {
    return false
  }

  const { data: schema } = JSON.parse(text)
  await writeGraphQLClient(folder, name, schema, url, generateImplementation)
  return 'graphql'
}

async function readFromFileAndWrite (logger, file, folder, name, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders) {
  logger.info(`Trying to read schema from file ${file}`)
  const text = await readFile(file, 'utf8')
  // try OpenAPI first
  try {
    await writeOpenAPIClient(folder, name, text, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders)
    return 'openapi'
  } catch (err) {
    logger.error(`Error parsing OpenAPI definition: ${err.message} Trying with GraphQL`)
    // try GraphQL
    const schema = graphql.buildSchema(text)
    const introspectionResult = graphql.introspectionFromSchema(schema)

    // dummy URL
    await writeGraphQLClient(folder, name, introspectionResult, 'http://localhost:3042/graphql', generateImplementation)
    return 'graphql'
  }
}

async function downloadAndProcess (options) {
  const {
    url,
    name,
    folder,
    logger,
    runtime,
    generateImplementation,
    typesOnly,
    fullRequest,
    fullResponse,
    optionalHeaders
  } = options
  let config = options.config
  if (!config) {
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName)))
    config = configFileNames.find((value, index) => configFilesAccessibility[index])
  }

  let found = false
  const toTry = []
  if (url.startsWith('http')) {
    // add download functions only if it's an URL
    toTry.push(downloadAndWriteOpenAPI.bind(null, logger, url + '/documentation/json', folder, name, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders))
    toTry.push(downloadAndWriteGraphQL.bind(null, logger, url + '/graphql', folder, name, generateImplementation, typesOnly))
    toTry.push(downloadAndWriteOpenAPI.bind(null, logger, url, folder, name, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders))
    toTry.push(downloadAndWriteGraphQL.bind(null, logger, url, folder, name, generateImplementation, typesOnly))
  } else {
    // add readFromFileAndWrite to the functions only if it's not an URL
    toTry.push(
      readFromFileAndWrite.bind(null, logger, url, folder, name, generateImplementation, typesOnly, fullRequest, fullResponse, optionalHeaders)
    )
  }
  for (const fn of toTry) {
    found = await fn()
    if (found) {
      break
    }
  }
  /* c8 ignore next 3 */
  if (!found) {
    throw new Error(`Could not find a valid OpenAPI or GraphQL schema at ${url}`)
  }

  if (config && !typesOnly) {
    const meta = await analyze({ file: config })
    meta.config.clients = meta.config.clients || []
    if (runtime) {
      meta.config.clients = meta.config.clients.filter((client) => client.serviceId !== runtime)
    } else {
      meta.config.clients = meta.config.clients.filter((client) => client.name !== name)
    }
    let schema
    if (found === 'openapi') {
      schema = posix.join(relative(dirname(resolve(config)), resolve(folder)), `${name}.openapi.json`)
    } else if (found === 'graphql') {
      schema = posix.join(relative(dirname(resolve(config)), resolve(folder)), `${name}.schema.graphql`)
    }
    const toPush = {
      schema,
      name,
      type: found
    }
    if (runtime) {
      toPush.serviceId = runtime
    } else {
      toPush.url = `{PLT_${name.toUpperCase()}_URL}`
    }
    meta.config.clients.push(toPush)
    await write(meta)
    if (!runtime) {
      try {
        const toSaveUrl = new URL(url)
        if (found === 'openapi') {
          toSaveUrl.pathname = ''
        }
        await appendToBothEnvs(join(dirname(config)), `PLT_${name.toUpperCase()}_URL`, toSaveUrl)
      } catch {
        await appendToBothEnvs(join(dirname(config)), `PLT_${name.toUpperCase()}_URL`, '')
      }
    }
  }
}

function getPackageJSON ({ name, generateImplementation }) {
  const obj = {
    name,
    types: `./${name}.d.ts`
  }

  if (generateImplementation) {
    obj.main = `./${name}.cjs`
  }

  return JSON.stringify(obj, null, 2)
}

export async function command (argv) {
  const help = helpMe({
    dir: desm.join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })
  let { _: [url], ...options } = parseArgs(argv, {
    string: ['name', 'folder', 'runtime', 'optional-headers'],
    boolean: ['typescript', 'full-response', 'types-only', 'full-response', 'full'],
    default: {
      name: 'client',
      typescript: false
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript',
      c: 'config',
      R: 'runtime',
      F: 'full'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)
  if (options.full || options.F) {
    // force both fullRequest and fullResponse
    options['full-request'] = true
    options['full-response'] = true
  }
  const stream = pinoPretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
    minimumLevel: 'debug',
    sync: true
  })

  const logger = pino(stream)

  let runtime

  if (options.runtime) {
    const runtimeConfigFile = await findUp('platformatic.runtime.json')

    const { configManager } = await loadConfig({}, ['-c', runtimeConfigFile], platformaticRuntime)

    configManager.current.hotReload = false

    for (const service of configManager.current.services) {
      service.localServiceEnvVars.set('PLT_SERVER_LOGGER_LEVEL', 'warn')
      service.entrypoint = false
      service.watch = false
    }

    runtime = new RuntimeApi(configManager.current, logger)
    await runtime.startServices()

    url = `http://${options.runtime}.plt.local`
  }

  if (!url) {
    await help.toStdout()
    process.exit(1)
  }

  try {
    if (options['types-only']) {
      options.generateImplementation = false
      options.typesOnly = true
      options.folder = process.cwd()
    } else {
      options.generateImplementation = !options.config
    }

    options.fullRequest = options['full-request']
    options.fullResponse = options['full-response']
    options.optionalHeaders = options['optional-headers']
      ? options['optional-headers'].split(',').map((h) => h.trim())
      : []

    await downloadAndProcess({ url, ...options, logger, runtime: options.runtime })
    logger.info('Client generated successfully')
    logger.info('Check out the docs to know more: https://docs.platformatic.dev/docs/reference/client/introduction')
    if (runtime) {
      await runtime.stopServices()
    }
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}
