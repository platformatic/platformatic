/*
  Resolves in ten minutes, which is to say never. The event loop stays alive — an awaited fetch to a
  host that accepts and then says nothing looks exactly like this — so nothing else ends the worker
  and the deadline is the only thing that can.
*/
export default async () => {
  await new Promise(resolve => setTimeout(resolve, 600000))
  return { applications: [] }
}
