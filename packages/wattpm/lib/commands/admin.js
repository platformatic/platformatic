import { spawn } from 'node:child_process'
import { parseArgs } from '../utils.js'
import { getPackageManager } from '@platformatic/utils'

export function adminCommand (logger, args) {
  let {
    values: { latest, 'package-manager': packageManager }
  } = parseArgs(
    args,
    {
      latest: {
        type: 'boolean',
        short: 'l'
      },
      'package-manager': {
        type: 'string',
        short: 'P'
      }
    },
    false
  )

  if (!packageManager) {
    packageManager = getPackageManager(process.cwd())
  }

  const modifier = latest ? '@latest' : ''

  let command = 'npx'
  const commandArgs = ['@platformatic/watt-admin' + modifier]

  if (packageManager === 'pnpm') {
    command = 'pnpx'
  } else {
    commandArgs.unshift('-y')
  }

  logger.info(`Running watt-admin via ${command} ...`)
  const proc = spawn(command, commandArgs, { stdio: 'inherit' })

  proc.on('exit', code => {
    process.exit(code)
  })
}

export const help = {
  admin: {
    usage: 'admin',
    description: 'Start the admin interface',
    options: [
      {
        usage: '-l --latest',
        description: 'Use the latest version of @platformatic/watt-admin from'
      },
      {
        usage: 'P, --package-manager <executable>',
        description: 'Use an alternative package manager (the default is to autodetect it)'
      }
    ]
  }
}
