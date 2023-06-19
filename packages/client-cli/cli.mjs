#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join, dirname } from 'path'
import * as desm from 'desm'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'
import { processGraphQL } from './lib/gen-graphql.mjs'
import ConfigManager from '@platformatic/config'
import { analyze, write } from '@platformatic/metaconfig'
import graphql from 'graphql'
import { appendToBothEnvs } from './lib/utils.mjs'

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

const configFileNames = ConfigManager.listConfigFiles()

async function writeOpenAPIClient (folder, name, text, fullResponse) {
  await mkdir(folder, { recursive: true })

  // TODO deal with yaml
  const schema = JSON.parse(text)
  await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
  const { types, implementation } = processOpenAPI({ schema, name, fullResponse })
  await writeFile(join(folder, `${name}.d.ts`), types)
  await writeFile(join(folder, `${name}.cjs`), implementation)
  await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
}

async function writeGraphQLClient (folder, name, schema, url) {
  await mkdir(folder, { recursive: true })
  const { types, implementation } = processGraphQL({ schema, name, folder, url })
  const clientSchema = graphql.buildClientSchema(schema)
  const sdl = graphql.printSchema(clientSchema)
  await writeFile(join(folder, `${name}.schema.graphql`), sdl)
  await writeFile(join(folder, `${name}.d.ts`), types)
  await writeFile(join(folder, `${name}.cjs`), implementation)
  await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
}

async function downloadAndProcess ({ url, name, folder, config, r: fullResponse }) {
  try {
    // try OpenAPI first
    let res = await request(url)
    if (res.statusCode === 200) {
      // we are OpenAPI
      const text = await res.body.text()
      await writeOpenAPIClient(folder, name, text, fullResponse)
    } else {
      res.body.resume()

      const query = graphql.getIntrospectionQuery()

      // try GraphQL
      res = await request(url, {
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
        throw new Error('Could not download file')
      }

      const { data: schema } = JSON.parse(text)
      await writeGraphQLClient(folder, name, schema, url)
    }
  } catch (err) {
    if (
      err.code !== 'ERR_INVALID_URL' &&
      err.code !== 'UND_ERR_INVALID_ARG'
    ) {
      throw err
    }

    const text = await readFile(url, 'utf8')

    // try OpenAPI first
    try {
      await writeOpenAPIClient(folder, name, text, fullResponse)
    } catch {
      // try GraphQL
      const schema = graphql.buildSchema(text)
      const introspectionResult = graphql.introspectionFromSchema(schema)

      // dummy URL
      await writeGraphQLClient(folder, name, introspectionResult, 'http://localhost:3042/graphql')
    }
  }

  if (!config) {
    const configFilesAccessibility = await Promise.all(configFileNames.map((fileName) => isFileAccessible(fileName)))
    config = configFileNames.find((value, index) => configFilesAccessibility[index])
  }

  if (config) {
    const meta = await analyze({ file: config })
    meta.config.clients = meta.config.clients || []
    meta.config.clients.push({
      path: `./${name}`,
      url: `{PLT_${name.toUpperCase()}_URL}`
    })
    await write(meta)
    const toSaveUrl = new URL(url)
    toSaveUrl.pathname = ''
    await appendToBothEnvs(join(dirname(config)), `PLT_${name.toUpperCase()}_URL`, toSaveUrl)
  }
}

function getPackageJSON ({ name }) {
  return JSON.stringify({
    name,
    main: `./${name}.cjs`,
    types: `./${name}.d.ts`
  }, null, 2)
}

export async function command (argv) {
  const help = helpMe({
    dir: desm.join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })
  const { _: [url], ...options } = parseArgs(argv, {
    string: ['name', 'folder'],
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
      r: 'full-response'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)
  if (!url) {
    await help.toStdout()
    process.exit(1)
  }

  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(options.name) === false) {
    console.error(`Invalid client name '${options.name}', allowed characters are a-z, A-Z, 0-9, $ and _`)
    process.exit(1)
  }

  try {
    await downloadAndProcess({ url, ...options })
  } catch (err) {
    console.error(err)
    console.log('')
    await help.toStdout()
    process.exit(1)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}
