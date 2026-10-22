function fibonacci (n) {
  return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2)
}

function computeChecksum (rows) {
  let sum = 0
  for (let i = 0; i < rows; i++) {
    sum = (sum * 31 + fibonacci(i % 20)) % 1000003
  }
  return sum
}

export default async function (app) {
  app.get('/', async () => ({ message: 'Hello from minified code' }))

  app.get('/compute', async () => ({ result: computeChecksum(3000) + fibonacci(25) }))
}
