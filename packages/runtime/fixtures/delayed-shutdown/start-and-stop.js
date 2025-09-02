import { createRuntime } from '../../test/helpers.js'

async function main () {
  const runtime = await createRuntime(process.argv[2])
  await runtime.start()

  setTimeout(() => {
    process.kill(process.pid, 'SIGINT')
  })
}

main()
