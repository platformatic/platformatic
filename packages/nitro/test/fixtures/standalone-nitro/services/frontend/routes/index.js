export default defineEventHandler(() => {
  console.log('Log from Nitro route')
  return '<html><head><title>Nitro</title></head><body>Hello from Nitro</body></html>'
})
