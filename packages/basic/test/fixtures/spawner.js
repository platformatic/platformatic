import { spawn as nodeSpawn } from 'node:child_process'

export async function spawn (executable, args, spawnOptions, stdout, stderr) {
  const subprocess = nodeSpawn(executable, args, spawnOptions)

  subprocess.stdout.setEncoding('utf8')
  subprocess.stderr.setEncoding('utf8')

  subprocess.stdout.pipe(this.stdout, { end: false })
  subprocess.stderr.pipe(this.stderr, { end: false })

  // Wait for the process to be started
  const { promise, resolve, reject } = Promise.withResolvers()

  subprocess.on('spawn', resolve)
  subprocess.on('error', reject)

  await promise
  return subprocess
}
