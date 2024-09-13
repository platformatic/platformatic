import { version } from '../../../tmp/version.js'

export async function generate () {
  const response = await fetch('http://backend.plt.local/time')
  const { time } = await response.json()
  return `<div>Hello from v${version} t${time}</div>`
}
