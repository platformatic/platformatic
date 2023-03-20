#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import * as desm from 'desm'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'
import { processGraphQL } from './lib/gen-graphql.mjs'
import { analyze, write } from '@platformatic/metaconfig'
import graphql from 'graphql'

async function isFileAccessible (filename) {
  try {
    await access(filename)
    return true
  } catch (err) {
    return false
  }
}

const configFileNames = [
  './platformatic.db.json',
  './platformatic.db.json5',
  './platformatic.db.yaml',
  './platformatic.db.yml',
  './platformatic.db.toml',
  './platformatic.db.tml',
  './platformatic.service.json',
  './platformatic.service.json5',
  './platformatic.service.yaml',
  './platformatic.service.yml',
  './platformatic.service.toml',
  './platformatic.service.tml'
]

async function downloadAndProcess ({ url, name, folder, config }) {
  // try OpenAPI first
  let res = await request(url)
  if (res.statusCode === 200) {
    // we are OpenAPI
    const text = await res.body.text()
    await mkdir(folder, { recursive: true })

    // TODO deal with yaml
    const schema = JSON.parse(text)
    await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
    const { types, implementation } = processOpenAPI({ schema, name })
    await writeFile(join(folder, `${name}.d.ts`), types)
    await writeFile(join(folder, `${name}.cjs`), implementation)
    await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
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

    await mkdir(folder, { recursive: true })
    const { data: schema } = JSON.parse(text)
    const { types, implementation } = processGraphQL({ schema, name, folder, url })
    const clientSchema = graphql.buildClientSchema(schema)
    const sdl = graphql.printSchema(clientSchema)
    await writeFile(join(folder, `${name}.schema.graphql`), sdl)
    await writeFile(join(folder, `${name}.d.ts`), types)
    await writeFile(join(folder, `${name}.cjs`), implementation)
    await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
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
    boolean: ['typescript'],
    default: {
      name: 'client',
      typescript: false
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript',
      c: 'config'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)
  if (!url) {
    await help.toStdout()
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
