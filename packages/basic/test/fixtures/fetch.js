import { setTimeout } from 'node:timers/promises'

globalThis[Symbol.for('plt.children.itc')].handle('start', async port => {
  {
    const response = await fetch(`http://127.0.0.1:${port}`)

    console.log(response.status, await response.json())
  }

  {
    const response = await fetch('http://service.plt.local/foo')

    console.log(response.status, await response.json())
  }

  {
    const response = await fetch('http://service.plt.local/bar')

    console.log(response.status, await response.json())
  }

  {
    const response = await fetch('http://service2.plt.local/error')

    console.log(response.status, (await response.json()).message)
  }

  // GitHub CI is slow
  if (process.env.CI) {
    await setTimeout(3000)
  }

  return true
})

globalThis[Symbol.for('plt.children.itc')].notify('ready')
