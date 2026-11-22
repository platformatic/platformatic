import { getPackageManager } from '@platformatic/foundation'
import { bold } from 'colorette'
import { spawn } from 'node:child_process'
import { platform } from 'node:os'

export async function runDelegatedCommand (context, logger, packageManager, args) {
  if (!packageManager) {
    packageManager = await getPackageManager(process.cwd())
  }

  let runner = 'npx'
  if (packageManager === 'pnpm') {
    runner = 'pnpx'
  } else {
    args.unshift('-y')
  }

  const socket = context.socket
  if (socket) {
    if (packageManager === 'pnpm') {
      args.push('--', '--socket', socket)
    } else {
      args.push('--socket', socket)
    }
  }

  logger.info(`Running ${bold(runner)} ${bold(args.join(' '))} ...`)

  const options = { stdio: 'inherit' }

  /* c8 ignore next 4 - Covered by CI */
  if (platform() === 'win32') {
    options.shell = true
    options.windowsVerbatimArguments = true
  }

  const proc = spawn(runner, args, options)
  proc.on('exit', code => {
    process.exit(code)
  })
}
