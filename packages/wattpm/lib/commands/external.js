import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { findConfigurationFile, parseArgs } from '../utils.js'

export async function importCommand (logger, args) {
  const {
    values: { directory: root },
    positionals
  } = parseArgs(
    args,
    {
      directory: {
        type: 'string',
        short: 'd',
        default: process.cwd()
      }
    },
    false
  )

  const configurationFile = await findConfigurationFile(logger, root)
  const rawUrl = positionals[0]

  if (!rawUrl) {
    logger.fatal('Please specify the resource to import.')
  }

  const url = rawUrl.match(/^[a-z0-9-]+\/[a-z0-9-]+$/i) ? `git@github.com:${rawUrl}.git` : rawUrl
  const service = positionals[1] ?? basename(url, '.git')
  const path = positionals[2] ?? service

  const config = JSON.parse(await readFile(resolve(root, configurationFile)))
  config.web ??= []
  config.web.push({ id: service, path, url })

  await writeFile(resolve(root, configurationFile), JSON.stringify(config, null, 2), 'utf-8')
}

export async function resolveCommand (logger, args) {}
