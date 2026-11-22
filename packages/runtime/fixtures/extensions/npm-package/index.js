let configured = 0

export function configure () {
  configured++
}

export function setup () {
  return configured
}
