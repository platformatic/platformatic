import { writeFile, access } from 'fs/promises'
import { join } from 'path'

export function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function appendToEnv (file, key, value) {
  const str = `\n${key}=${value}\n`
  try {
    await access(file)
    await writeFile(file, str, { flag: 'a' })
    console.log(file, str)
    /* c8 ignore next 1 */
  } catch {}
}

export async function appendToBothEnvs (dir, key, value) {
  console.log(dir, key, value)
  await Promise.all([
    appendToEnv(join(dir, '.env'), key, value),
    appendToEnv(join(dir, '.env.sample'), key, value)
  ])
}
