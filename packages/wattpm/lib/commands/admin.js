import { parseArgs } from '@platformatic/foundation'
import { runDelegatedCommand } from './create.js'

export async function adminCommand (logger, args) {
  const {
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

  return runDelegatedCommand(logger, packageManager, ['@platformatic/watt-admin' + (latest ? '@latest' : '')])
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
