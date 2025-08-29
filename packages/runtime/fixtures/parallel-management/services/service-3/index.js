export default async function service3 () {
  await new Promise(resolve => setTimeout(resolve, 1500))
  throw new Error('Service 3 failed to start')
}
