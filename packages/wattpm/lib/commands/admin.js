import { spawn } from 'node:child_process'
import { parseArgs } from '../utils.js'

export function adminCommand (logger, args) {
  logger.info('Running watt-admin via npx')
  const {
    values: { latest },
  } = parseArgs(
    args,
    {
      latest: {
        type: 'boolean',
        short: 'l'
      },
    },
    false
  )
  const modifier = latest ? '@latest' : ''
  const proc = spawn('npx', ['-y', '@platformatic/watt-admin' + modifier], { stdio: 'inherit' })

  proc.on('exit', (code) => {
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
        description: 'Use the latest version of @platformatic/watt-admin from',
      },
    ]
  },
}
