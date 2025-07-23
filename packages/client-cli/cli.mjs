#! /usr/bin/env node

import { findConfigurationFile, getParser, getStringifier, loadConfig } from '@platformatic/config'
import { createDirectory } from '@platformatic/utils'
import camelcase from 'camelcase'
import * as desm from 'desm'
import isMain from 'es-main'
import { access, readFile, writeFile } from 'fs/promises'
import graphql from 'graphql'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { dirname, join, posix, relative, resolve } from 'path'
import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { getGlobalDispatcher, interceptors, request, setGlobalDispatcher } from 'undici'
import YAML from 'yaml'
import errors from './lib/errors.mjs'
import { processFrontendOpenAPI } from './lib/frontend-openapi-generator.mjs'
import { processGraphQL } from './lib/graphql-generator.mjs'
import { processOpenAPI } from './lib/openapi-generator.mjs'
import { appendToBothEnvs } from './lib/utils.mjs'

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

export async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

async function writeOpenAPIClient (
  folder,
  name,
  text,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  typesComment,
  logger,
  withCredentials,
  propsOptional
) {
  await createDirectory(folder)

  // TODO deal with yaml
  const schema = parseFile(text)
  if (!schema) {
    throw new Error('Cannot parse OpenAPI file. Please make sure is a JSON or a YAML file.')
  }
  if (!typesOnly) {
    await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
  }

  if (isFrontend) {
    const { types, implementation } = processFrontendOpenAPI({
      schema,
      name,
      fullRequest,
      fullResponse,
      language,
      logger,
      withCredentials,
      propsOptional
    })
    await writeFile(join(folder, `${name}-types.d.ts`), types)
    if (generateImplementation) {
      const extension = language === 'js' ? 'mjs' : 'ts'
      await writeFile(join(folder, `${name}.${extension}`), implementation)
    }
  } else {
    const { types, implementation } = processOpenAPI({
      schema,
      name,
      fullResponse,
      fullRequest,
      optionalHeaders,
      validateResponse,
      typesComment,
      propsOptional
    })
    await writeFile(join(folder, `${name}.d.ts`), types)
    if (generateImplementation) {
      await writeFile(join(folder, `${name}.cjs`), implementation)
    }

    if (!typesOnly) {
      await writeFile(join(folder, 'package.json'), getPackageJSON({ name, generateImplementation }))
    }
  }
}

async function writeGraphQLClient (folder, name, schema, url, generateImplementation) {
  await createDirectory(folder, { recursive: true })
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

async function downloadAndWriteOpenAPI (
  logger,
  url,
  folder,
  name,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  urlAuthHeaders,
  typesComment,
  withCredentials,
  propsOptional,
  retryTimeoutMs
) {
  logger.debug(`Trying to download OpenAPI schema from ${url}`)
  let requestOptions
  if (urlAuthHeaders) {
    try {
      requestOptions = { headers: JSON.parse(urlAuthHeaders) }
    } catch (err) {
      logger.error(err)
    }
  }

  const dispatcher = retryTimeoutMs ? getGlobalDispatcher().compose([interceptors.retry({ minTimeout: retryTimeoutMs }), interceptors.responseError()]) : undefined
  const res = await request(url, { ...requestOptions, dispatcher })
  if (res.statusCode === 200) {
    // we are OpenAPI
    const text = await res.body.text()
    try {
      await writeOpenAPIClient(
        folder,
        name,
        text,
        generateImplementation,
        typesOnly,
        fullRequest,
        fullResponse,
        optionalHeaders,
        validateResponse,
        isFrontend,
        language,
        typesComment,
        logger,
        withCredentials,
        propsOptional
      )
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

async function readFromFileAndWrite (
  logger,
  file,
  folder,
  name,
  generateImplementation,
  typesOnly,
  fullRequest,
  fullResponse,
  optionalHeaders,
  validateResponse,
  isFrontend,
  language,
  typesComment,
  withCredentials,
  propsOptional
) {
  logger.info(`Trying to read schema from file ${file}`)
  const text = await readFile(file, 'utf8')
  // try OpenAPI first
  try {
    await writeOpenAPIClient(
      folder,
      name,
      text,
      generateImplementation,
      typesOnly,
      fullRequest,
      fullResponse,
      optionalHeaders,
      validateResponse,
      isFrontend,
      language,
      typesComment,
      logger,
      withCredentials,
      propsOptional
    )
    return 'openapi'
  } catch (err) {
    logger.error(err, `Error parsing OpenAPI definition: "${err.message}". Trying with GraphQL`)
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
    typesOnly,
    fullRequest,
    fullResponse,
    optionalHeaders,
    validateResponse,
    isFrontend,
    language,
    type,
    urlAuthHeaders,
    typesComment,
    withCredentials,
    propsOptional,
    skipConfigUpdate,
    retryTimeoutMs
  } = options

  let generateImplementation = options.generateImplementation
  let config = options.config

  if (!config && !isFrontend) {
    config = await findConfigurationFile(process.cwd(), null, ['service', 'db', 'composer'])
  }

  if (config && !isFrontend) {
    // if config file is found, no implementation is needed because from the 'clients' section
    // of the config file, Platformatic will register automatically the client
    generateImplementation = false
  }

  let found = false
  const toTry = []
  if (url.startsWith('http')) {
    if (type === 'openapi') {
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url + '/documentation/json',
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs
        )
      )
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs
        )
      )
    } else if (options.type === 'graphql') {
      toTry.push(
        downloadAndWriteGraphQL.bind(null, logger, url + '/graphql', folder, name, generateImplementation, typesOnly)
      )
      toTry.push(downloadAndWriteGraphQL.bind(null, logger, url, folder, name, generateImplementation, typesOnly))
    } else {
      // add download functions only if it's an URL
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url + '/documentation/json',
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs
        )
      )
      toTry.push(
        downloadAndWriteGraphQL.bind(null, logger, url + '/graphql', folder, name, generateImplementation, typesOnly)
      )
      toTry.push(
        downloadAndWriteOpenAPI.bind(
          null,
          logger,
          url,
          folder,
          name,
          generateImplementation,
          typesOnly,
          fullRequest,
          fullResponse,
          optionalHeaders,
          validateResponse,
          isFrontend,
          language,
          urlAuthHeaders,
          typesComment,
          withCredentials,
          propsOptional,
          retryTimeoutMs
        )
      )
      toTry.push(downloadAndWriteGraphQL.bind(null, logger, url, folder, name, generateImplementation, typesOnly))
    }
  } else {
    // add readFromFileAndWrite to the functions only if it's not an URL
    toTry.push(
      readFromFileAndWrite.bind(
        null,
        logger,
        url,
        folder,
        name,
        generateImplementation,
        typesOnly,
        fullRequest,
        fullResponse,
        optionalHeaders,
        validateResponse,
        isFrontend,
        language,
        typesComment,
        withCredentials,
        propsOptional
      )
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

  if (config && !skipConfigUpdate && !typesOnly && !isFrontend) {
    const parse = getParser(config)
    const stringify = getStringifier(config)
    const data = parse(await readFile(config, 'utf8'))
    data.clients = data.clients || []
    if (runtime) {
      data.clients = data.clients.filter(client => client.serviceId !== runtime)
    } else {
      data.clients = data.clients.filter(client => client.name !== name)
    }
    let schema
    if (found === 'openapi') {
      schema = posix.join(relative(dirname(resolve(config)), resolve(folder)), `${name}.openapi.json`)
    } else if (found === 'graphql') {
      schema = posix.join(relative(dirname(resolve(config)), resolve(folder)), `${name}.schema.graphql`)
    }

    // Make sure only Unix paths are used in the config file
    schema = schema.replace(/\\/g, '/')

    const toPush = {
      schema,
      name: camelcase(name),
      type: found
    }
    const availableCommandLineOptionsInClient = ['fullRequest', 'fullResponse', 'validateResponse']
    availableCommandLineOptionsInClient.forEach(c => {
      if (options[c]) {
        toPush[c] = true
      }
    })
    if (runtime) {
      toPush.serviceId = runtime
    } else {
      toPush.url = `{PLT_${name.toUpperCase()}_URL}`
    }
    data.clients.push(toPush)
    await writeFile(config, stringify(data))
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
  let {
    _: [url],
    ...options
  } = parseArgs(argv, {
    string: ['name', 'folder', 'runtime', 'optional-headers', 'language', 'type', 'url-auth-headers', 'types-comment'],
    boolean: ['typescript', 'full-response', 'types-only', 'full-request', 'full', 'frontend', 'validate-response', 'props-optional', 'skip-config-update'],
    default: {
      typescript: false,
      language: 'js'
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript',
      c: 'config',
      R: 'runtime',
      F: 'full',
      h: 'help'
    }
  })

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
    // Find the runtime config file
    const runtimeConfigFile = await findConfigurationFile(process.cwd(), null, 'runtime')

    if (!runtimeConfigFile) {
      logger.error('Could not find a platformatic.json file in any parent directory.')
      process.exit(1)
    }

    let runtimeModule

    try {
      runtimeModule = await import('@platformatic/runtime')

      // Ignoring the catch block.
      // TODO(mcollina): we would need to setup ESM import
      // mocking.
      /* c8 ignore next 7 */
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        logger.error("We couldn't find the @platformatic/runtime package, make sure you have it installed.")
        process.exit(1)
      }
      throw err
    }

    const { Runtime, platformaticRuntime, getRuntimeLogsDir } = runtimeModule
    const { configManager } = await loadConfig({}, ['-c', runtimeConfigFile], platformaticRuntime)

    configManager.current.watch = false
    configManager.current.logger.level = 'error'

    for (const service of configManager.current.services) {
      service.localServiceEnvVars.set('PLT_SERVER_LOGGER_LEVEL', 'warn')
      service.entrypoint = false
      service.watch = false
    }

    const runtimeLogsDir = getRuntimeLogsDir(configManager.dirname, process.pid)
    runtime = new Runtime(configManager, runtimeLogsDir, process.env)
    await runtime.init()
    await runtime.start()

    // Set interceptors
    setGlobalDispatcher(runtime.getDispatcher())

    url = `http://${options.runtime}.plt.local`
  }

  if (!url || options.help) {
    await help.toStdout()
    process.exit(1)
  }

  try {
    options.isFrontend = !!options.frontend
    if (options['types-only']) {
      options.generateImplementation = false
      options.typesOnly = true
    } else {
      options.generateImplementation = options.isFrontend ? true : !options.config
    }

    options.fullRequest = options['full-request']
    options.fullResponse = options['full-response']

    // TODO: default value to true in the next semver-major (https://github.com/platformatic/platformatic/issues/3737)
    options.propsOptional = options['props-optional'] ?? false

    options.optionalHeaders = options['optional-headers']
      ? options['optional-headers'].split(',').map(h => h.trim())
      : []

    options.validateResponse = options['validate-response']

    if (!options.name) {
      options.name = options.isFrontend ? 'api' : 'client'
    }
    options.folder = options.folder || join(process.cwd(), options.name)
    options.urlAuthHeaders = options['url-auth-headers']
    options.typesComment = options['types-comment']
    options.withCredentials = options['with-credentials']
    options.skipConfigUpdate = options['skip-config-update']
    options.retryTimeoutMs = options['retry-timeout-ms']
    await downloadAndProcess({ url, ...options, logger, runtime: options.runtime })
    logger.info(`Client generated successfully into ${options.folder}`)
    logger.info('Check out the docs to know more: https://docs.platformatic.dev/docs/service/overview')
    if (runtime) {
      await runtime.close()
    }
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}

export { errors }
