import { join } from 'desm'
import isMain from 'es-main'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import camelcase from 'camelcase'
import { request } from 'undici'
import { readFile, writeFile } from 'fs/promises'
import { processOpenAPI } from './lib/gen-openapi.mjs'

async function frontendTemplate ({ source, language, name }) {
  const help = helpMe({
    dir: join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })
  let schema
  if (source.startsWith('http')) {
    // Load the OpenAPI spec
    let res

    const apiUrl = source.endsWith('/') ? source.replace(/\/$/, '') : source // Remove the trailing slash
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

    schema = JSON.parse(text)
  } else {
    // source is a file
    schema = JSON.parse(await readFile(source, 'utf-8'))
  }
  const { types, implementation } = processOpenAPI({ schema, name, language })
  await writeFile(`${name}-types.d.ts`, types)
  await writeFile(`${name}.${language}`, implementation)

  console.log(`Created the following files: ${name}-types.d.ts, ${name}.${language}`)
}

export async function command (argv) {
  let {
    _: [source, language], name
  } = parseArgs(argv)

  const help = helpMe({
    dir: join(import.meta.url, 'help'),
    // the default
    ext: '.txt'
  })
  if (!name) {
    name = 'api'
  } else {
    name = camelcase(name)
  }
  const missingParams = !source && !language
  const missingLanguage = !language || (language !== 'ts' && language !== 'js')

  if (missingParams || missingLanguage) {
    await help.toStdout(['invalid-params'])
    process.exit(1)
  }

  try {
    await frontendTemplate({ source, language, name })
  } catch (err) {
    console.error(err)
  }
}

if (isMain(import.meta)) {
  command(process.argv.slice(2))
}
