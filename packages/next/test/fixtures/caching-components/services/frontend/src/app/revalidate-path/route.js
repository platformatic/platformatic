import { getEvents } from '@platformatic/globals'
import { revalidatePath } from 'next/cache'

export async function GET () {
  revalidatePath('/', 'layout')

  setTimeout(() => {
    const events = getEvents()
    events.emitAndNotify('revalidated')
  }, 100)

  return Response.json({ ok: true })
}
