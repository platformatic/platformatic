'use strict'

const { writeFile } = require('fs').promises
const { join } = require('path')

// Add the modules here. Remember to add the dependency to package.json
const modules = [
  '@platformatic/service',
  '@platformatic/sql-mapper',
  '@platformatic/sql-openapi',
  '@platformatic/sql-graphql',
  '@platformatic/sql-events',
  '@platformatic/sql-json-schema-mapper',
  '@platformatic/telemetry',
  '@platformatic/utils'
]

const extractErrors = (module) => {
  const { errors } = module
  const ret = []
  for (const error in errors) {
    const ErrorFunc = errors[error]
    const err = new ErrorFunc()
    const code = err.code
    const fastifyErrorHeader = `FastifyError [${code}]:`
    const message = err.toString().replace(fastifyErrorHeader, '').trim()
    ret.push({ code, message })
  }
  return ret
}

const createErrorsMD = (errorsByModule) => {
  const md = []
  md.push('# Platformatic Errors \n')
  for (const module in errorsByModule) {
    md.push(`## ${module} \n`)
    const errors = errorsByModule[module]
    if (errors.length === 0) {
      md.push('**No errors defined** \n')
      continue
    }
    for (const error of errors) {
      const { code, message } = error
      md.push(`### ${code}`)
      md.push(`**Message:** ${message} \n`)
    }
  }
  return md.join('\n')
}

const generateErrorsMDFile = async (errorsByModule) => {
  const errorsMd = createErrorsMD(errorsByModule)
  const mdPath = join(__dirname, '..', '..', 'docs', 'reference', 'errors.md')
  await writeFile(mdPath, errorsMd)
  console.log(`Errors documentation file generated at ${mdPath}`)
}

const errorsByModule = {}
for (const module of modules) {
  const mod = require(module)
  const errors = extractErrors(mod)
  errorsByModule[module] = errors
}

generateErrorsMDFile(errorsByModule)
