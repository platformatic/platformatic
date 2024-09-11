import { version } from '../../../tmp/version.js'

export async function generate () {
  return `<div>Hello from v${version} t${Date.now()}</div>`
}
