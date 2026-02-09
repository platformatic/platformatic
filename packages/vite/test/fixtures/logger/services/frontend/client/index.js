const version = 123

globalThis.platformatic.logger?.info('Log from vite client')

export async function generate () {
  return `<div>Hello from v${version} t${Date.now()}</div>`
}
