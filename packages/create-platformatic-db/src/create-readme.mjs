import { isFileAccessible } from './utils.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const createReadme = async (logger, dir = '.') => {
  const readmeFileName = join(dir, 'README.md')
  const isReadmeExists = await isFileAccessible(readmeFileName)
  if (!isReadmeExists) {
    const readmeFile = new URL('README.md', import.meta.url)
    const readme = readFileSync(readmeFile, 'utf-8')
    writeFileSync(readmeFileName, readme)
    logger.debug(`${readmeFileName} successfully created.`)
  } else {
    logger.debug(`${readmeFileName} found, skipping creation of README.md file.`)
  }
}
