import camelcase from 'camelcase'
import { readFile, writeFile } from 'fs/promises'
import helpMe from 'help-me'
import parseArgs from 'minimist'
import { join } from 'node:path'
import { request } from 'undici'
import { processOpenAPI } from './lib/gen-openapi.js'

async function frontendTemplate ({ source, language, name, fullResponse }) {
  const help = helpMe({
    dir: join(import.meta.dirname, 'help'),
    // the default
    ext: '.txt'
  })
  let schema
  if (source.startsWith('http')) {
    try {
      // Load the OpenAPI spec
      const apiUrl = new URL(source)
      if (apiUrl.pathname === '/') {
        apiUrl.pathname = '/documentation/json'
      }
      const res = await request(apiUrl)

      if (res.statusCode !== 200) {
        await help.toStdout(['open-api-server-no-200'])
        process.exit(1)
      }

      const text = await res.body.text()
      schema = JSON.parse(text)
    } catch (err) {
      await help.toStdout(['open-api-server-error'])
      process.exit(1)
    }
  } else {
    // source is a file
    schema = JSON.parse(await readFile(source, 'utf-8'))
  }
  const { types, implementation } = processOpenAPI({ schema, name, language, fullResponse })
  await writeFile(`${name}-types.d.ts`, types)
  await writeFile(`${name}.${language}`, implementation)

  console.log(`Created the following files: ${name}-types.d.ts, ${name}.${language}`)
}

export async function command (argv) {
  let {
    _: [source, language],
    name,
    'full-response': fullResponse
  } = parseArgs(argv)
  const help = helpMe({
    dir: join(import.meta.dirname, 'help'),
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
    await frontendTemplate({ source, language, name, fullResponse })
  } catch (err) {
    console.error(err)
  }
}

if (import.meta.main) {
  command(process.argv.slice(2))
}
