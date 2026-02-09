import { create } from '../../index.js'

async function main () {
  const runtime = await create(process.argv[2])
  await runtime.start()

  setTimeout(() => {
    process.kill(process.pid, 'SIGINT')
  })
}

main()
