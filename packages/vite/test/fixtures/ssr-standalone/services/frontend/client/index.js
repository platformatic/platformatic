const version = 123

export async function generate () {
  return `<div>Hello from v${version} t${Date.now()}</div>`
}
