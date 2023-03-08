#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'
import { processGraphQL } from './lib/gen-graphql.mjs'
import graphql from 'graphql'

async function downloadAndProcess ({ url, name, folder }) {
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
    await writeFile(join(folder, `${name}.schema.graphql`), text)
    const { types, implementation } = processGraphQL({ schema: text, name, folder, url })
    await writeFile(join(folder, `${name}.d.ts`), types)
    await writeFile(join(folder, `${name}.cjs`), implementation)
    await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
  }
}

function getPackageJSON ({ name }) {
  return JSON.stringify({
    name,
    main: `./${name}.cjs`,
    types: `./${name}.d.ts`
  }, null, 2)
}

if (isMain(import.meta)) {
  const { _: [url], ...options } = parseArgs(process.argv.slice(2), {
    string: ['name', 'folder'],
    boolean: ['typescript'],
    default: {
      name: 'client',
      typescript: false
    },
    alias: {
      n: 'name',
      f: 'folder',
      t: 'typescript'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)
  if (!url) {
    console.error(helpMe())
    process.exit(1)
  }
  downloadAndProcess({ url, ...options })
}
