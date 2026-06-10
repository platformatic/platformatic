import { getEvents } from '@platformatic/globals'
import { revalidateTag } from 'next/cache'

export const revalidate = 120

export async function GET () {
  revalidateTag('first', 'max')
  revalidateTag('second', 'max')
  revalidateTag('third', 'max')

  setTimeout(() => {
    const events = getEvents()
    events.emitAndNotify('revalidated')
  }, 100)

  return Response.json({ ok: true })
}
