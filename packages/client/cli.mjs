#! /usr/bin/env node

import parseArgs from 'minimist'
import isMain from 'es-main'
import helpMe from 'help-me'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.mjs'

async function downloadAndProcess ({ url, name, folder }) {
  const res = await request(url)
  if (res.statusCode !== 200) {
    throw new Error('Could not download file')
  }

  const text = await res.body.text()
  await mkdir(folder, { recursive: true })

  // TODO deal with yaml
  if (res.headers['content-type'] === 'application/json; charset=utf-8') {
    const schema = JSON.parse(text)
    await writeFile(join(folder, `${name}.openapi.json`), JSON.stringify(schema, null, 2))
    const { types, implementation } = processOpenAPI({ schema, name })
    await writeFile(join(folder, `${name}.d.ts`), types)
    await writeFile(join(folder, `${name}.cjs`), implementation)
    await writeFile(join(folder, 'package.json'), getPackageJSON({ name }))
  } else {
    await writeFile(join(folder, `${name}.schema.graphql`), text)
    await processGraphQL({ schema: text, name, folder })
  }
}

function getPackageJSON ({ name }) {
  return JSON.stringify({
    name,
    main: `./${name}.cjs`,
    types: `./${name}.d.ts`
  }, null, 2)
}

async function processGraphQL ({ schema, name, folder }) {
}

if (isMain(import.meta)) {
  const { _: [url], ...options } = parseArgs(process.argv.slice(2), {
    string: ['name', 'folder'],
    default: {
      name: 'client'
    }
  })
  options.folder = options.folder || join(process.cwd(), options.name)
  if (!url) {
    console.error(helpMe())
    process.exit(1)
  }
  downloadAndProcess({ url, ...options })
}
