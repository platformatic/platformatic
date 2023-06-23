import { writeFile, access } from 'fs/promises'
import camelcase from 'camelcase'
import { join } from 'path'

export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function classCase (str) {
  return str.split(/[^a-z]+/i).map(s => capitalize(s)).join('')
}

export async function appendToEnv (file, key, value) {
  const str = `\n${key}=${value}\n`
  try {
    await access(file)
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
