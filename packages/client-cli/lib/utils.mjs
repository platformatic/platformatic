import { writeFile, readFile } from 'fs/promises'
import camelcase from 'camelcase'
import { join } from 'path'

export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function classCase (str) {
  return str.split(/[^a-z]+/i).map(s => capitalize(s)).join('')
}

export async function appendToEnv (file, key, value) {
  try {
    const env = await readFile(file, 'utf8')
    if (env.includes(`${key}=`)) {
      return
    }
  } catch {
    // ignore error, file does not exist
  }
  const str = `\n${key}=${value}\n`
  try {
    await writeFile(file, str, { flag: 'a' })
    /* c8 ignore next 1 */
  } catch {}
}

export async function appendToBothEnvs (dir, key, value) {
  await Promise.all([
    appendToEnv(join(dir, '.env'), key, value),
    appendToEnv(join(dir, '.env.sample'), key, value)
  ])
}

export function toJavaScriptName (str) {
  return camelcase(str.replace(/[^a-zA-Z0-9]+/gi, ' '))
}

export function getResponseContentType (responseObject) {
  if (!responseObject || responseObject.content === undefined) {
    return null
  }

  const [firstContentType] = Object.entries(responseObject.content)
  return firstContentType[0]
}

export function is200JsonResponse (responses) {
  if (responses['200'] && responses['200'].content && responses['200'].content['application/json']) {
    return true
  }
  return false
}

export function getAllResponseCodes (responses) {
  return Object.keys(responses).map((code) => {
    return parseInt(code)
  })
}

export function getResponseTypes (responses) {
  const output = {
    text: [],
    blob: [],
    json: []
  }
  Object.keys(responses).forEach((code) => {
    const resp = responses[code]
    const intCode = parseInt(code)
    if (resp.content) {
      // get all type of contents
      Object.keys(resp.content).forEach((contentType) => {
        if (contentType === 'application/json') {
          output.json.push(intCode)
        } else if (contentType.startsWith('text/')) {
          output.text.push(intCode)
        } else {
          const respSchema = resp.content[contentType].schema
          if (respSchema.type && respSchema.type === 'string' && respSchema.format === 'binary') {
            output.blob.push(intCode)
          } else {
            output.text.push(intCode)
          }
        }
      })
    } else {
      output.text.push(intCode)
    }
  })
  return output
}
