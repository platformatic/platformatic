'use strict'
import { readFile, writeFile } from 'fs/promises'
import { join as desmJoin } from 'desm'
import { join } from 'path'

export const createReadme = async (logger, dir = '.', type) => {
  const readmeFileTarget = join(dir, 'README.md')
  const readmeFileSource = desmJoin(import.meta.url, type, 'README.md')
  const readme = await readFile(readmeFileSource, 'utf-8')
  await writeFile(readmeFileTarget, readme)
  logger.debug(`${readmeFileTarget} successfully created.`)
}
