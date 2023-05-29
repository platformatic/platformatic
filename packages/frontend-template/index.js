import { join } from 'desm'
import isMain from 'es-main'
import helpMe from 'help-me'
import parseArgs from 'minimist'

import { request } from 'undici'
import { writeFile } from 'fs/promises'
import { processOpenAPI } from './lib/gen-openapi.mjs'

async function frontendTemplate ({ url, language, name }) {
  const help = helpMe({
    dir: join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })

  // Load the OpenAPI spec
  let res
  const apiUrl = url.endsWith('/') ? url.replace(/\/$/, '') : url // Remove the trailing slash
  try {
    const documentationUrl = `${apiUrl}/documentation/json`
    res = await request(documentationUrl)
  } catch (err) {
    await help.toStdout(['open-api-server-error'])
    process.exit(1)
  }

  if (res.statusCode !== 200) {
    await help.toStdout(['open-api-server-no-200'])
    process.exit(1)
  }

  const text = await res.body.text()

  const schema = JSON.parse(text)
  const { types, implementation } = processOpenAPI({ schema, name, url: apiUrl, language })
  await writeFile(`${name}-types.d.ts`, types)
  await writeFile(`${name}.${language}`, implementation)

  console.log(`Created the following files: ${name}.d.ts, ${name}.${language}`)
}

export async function command (argv) {
  const {
    _: [url, language]
  } = parseArgs(argv)

  const help = helpMe({
    dir: join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })

  if (!url) {
    await help.toStdout(['invalid-url'])
    process.exit(1)
  }

  if (!language || (language !== 'ts' && language !== 'js')) {
    await help.toStdout(['invalid-language'])
    process.exit(1)
  }

  try {
    await frontendTemplate({ url, language, name: 'api' })
  } catch (err) {
    console.error(err)
    await help.toStdout(['invalid-url'])
    process.exit(1)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}
