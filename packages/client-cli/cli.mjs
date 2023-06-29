#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join, dirname, relative, resolve } from 'path'
import * as desm from 'desm'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'
import { processGraphQL } from './lib/gen-graphql.mjs'
import ConfigManager from '@platformatic/config'
import { analyze, write } from '@platformatic/metaconfig'
import graphql from 'graphql'
import { appendToBothEnvs } from './lib/utils.mjs'
import { RuntimeApi, platformaticRuntime } from '@platformatic/runtime'
import { loadConfig } from '@platformatic/service'
import { findUp } from 'find-up'
import pino from 'pino'
import pinoPretty from 'pino-pretty'

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

const configFileNames = ConfigManager.listConfigFiles()

async function writeOpenAPIClient (folder, name, text, fullResponse, generateImplementation) {
  await mkdir(folder, { recursive: true })

  // TODO deal with yaml
  const schema = JSON.parse(text)
  await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
  const { types, implementation } = processOpenAPI({ schema, name, fullResponse })
  await writeFile(join(folder, `${name}.d.ts`), types)
  if (generateImplementation) {
    await writeFile(join(folder, `${name}.cjs`), implementation)
  }
  await writeFile(join(folder, 'package.json'), getPackageJSON({ name, generateImplementation }))
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

async function downloadAndWriteOpenAPI (logger, url, folder, name, fullResponse, generateImplementation) {
  logger.info(`Trying to download OpenAPI schema from ${url}`)
  let res
  try {
    res = await request(url)
  } catch (err) {
    /* c8 ignore next 6 */
    if (
      err.code !== 'ERR_INVALID_URL' &&
      err.code !== 'UND_ERR_INVALID_ARG'
    ) {
      throw err
    }
    return false
  }

  if (res.statusCode === 200) {
    // we are OpenAPI
    const text = await res.body.text()
    try {
      await writeOpenAPIClient(folder, name, text, fullResponse, generateImplementation)
      /* c8 ignore next 3 */
    } catch (err) {
      return false
    }
    return 'openapi'
  }
  res.body.resume()

  return false
}

async function downloadAndWriteGraphQL (logger, url, folder, name, generateImplementation) {
  logger.info(`Trying to download GraphQL schema from ${url}`)
  const query = graphql.getIntrospectionQuery()
  let res

  try {
    res = await request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query
      })
    })
  } catch (err) {
    /* c8 ignore next 6 */
    if (
      err.code !== 'ERR_INVALID_URL' &&
      err.code !== 'UND_ERR_INVALID_ARG'
    ) {
      throw err
    }
    return false
  }

  const text = await res.body.text()

  if (res.statusCode !== 200) {
    return false
  }

  const { data: schema } = JSON.parse(text)
  await writeGraphQLClient(folder, name, schema, url, generateImplementation)
  return 'graphql'
}

async function readFromFileAndWrite (logger, file, folder, name, fullResponse, generateImplementation) {
  logger.info(`Trying to read schema from file ${file}`)
  const text = await readFile(file, 'utf8')

  // try OpenAPI first
  try {
    await writeOpenAPIClient(folder, name, text, fullResponse, generateImplementation)
    return 'openapi'
  } catch {
    // try GraphQL
    const schema = graphql.buildSchema(text)
    const introspectionResult = graphql.introspectionFromSchema(schema)

    // dummy URL
    await writeGraphQLClient(folder, name, introspectionResult, 'http://localhost:3042/graphql', generateImplementation)
    return 'graphql'
  }
}

async function downloadAndProcess ({ url, name, folder, config, r: fullResponse, logger, runtime }) {
  if (!config) {
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName)))
    config = configFileNames.find((value, index) => configFilesAccessibility[index])
  }

  let found = false
  const toTry = [
    downloadAndWriteOpenAPI.bind(null, logger, url + '/documentation/json', folder, name, fullResponse, !config),
    downloadAndWriteGraphQL.bind(null, logger, url + '/graphql', folder, name, !config),
    downloadAndWriteOpenAPI.bind(null, logger, url, folder, name, fullResponse, !config),
    downloadAndWriteGraphQL.bind(null, logger, url, folder, name, !config),
    readFromFileAndWrite.bind(null, logger, url, folder, name, fullResponse, !config)
  ]

  // readFromFileAndWrite is the last one, and it will throw if it cannot read the file
  // so we don't need to check for running out of options to try
  while (!found) {
    found = await toTry.shift()()
  }

  /* c8 ignore next 3 */
  if (!found) {
    throw new Error(`Could not find a valid OpenAPI or GraphQL schema at ${url}`)
  }

  if (config) {
    const meta = await analyze({ file: config })
    meta.config.clients = meta.config.clients || []
    if (meta.config.clients.find((client) => client.serviceId === runtime)) {
      throw new Error(`Client ${runtime} already exists in ${config}`)
    }
    let schema
    if (found === 'openapi') {
      schema = join(relative(dirname(resolve(config)), resolve(folder)), `${name}.openapi.json`)
    } else if (found === 'graphql') {
      schema = join(relative(dirname(resolve(config)), resolve(folder)), `${name}.schema.graphql`)
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
      const toSaveUrl = new URL(url)
      if (found === 'openapi') {
        toSaveUrl.pathname = ''
      }
      await appendToBothEnvs(join(dirname(config)), `PLT_${name.toUpperCase()}_URL`, toSaveUrl)
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
    string: ['name', 'folder', 'runtime'],
    boolean: ['typescript', 'full-response'],
    default: {
      name: 'client',
      typescript: false
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript',
      c: 'config',
      r: 'full-response',
      R: 'runtime'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)

  const stream = pinoPretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
    minimumLevel: 40,
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
    await downloadAndProcess({ url, ...options, logger, runtime: options.runtime })
    if (runtime) {
      await runtime.stopServices()
    }
  } catch (err) {
    logger.error({ err })
    process.exit(1)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}
