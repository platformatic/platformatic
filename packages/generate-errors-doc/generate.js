'use strict'

const { writeFile } = require('fs').promises
const { join } = require('path')

// Add the modules here. Remember to add the dependency to package.json
const modules = [
  '@platformatic/sql-mapper'
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
  md.push('# Platformatic Errors')
  md.push('\n')
  for (const module in errorsByModule) {
    md.push(`## ${module}`)
    md.push('\n')
    const errors = errorsByModule[module]
    for (const error of errors) {
      const { code, message } = error
      md.push(`### ${code}`)
      md.push(`**Message:** ${message} \n`)
    }
    md.join('\n')
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
