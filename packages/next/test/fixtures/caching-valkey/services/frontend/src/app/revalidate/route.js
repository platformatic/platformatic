import { revalidateTag } from 'next/cache'

export const revalidate = 120

export async function GET () {
  revalidateTag('first', 'max')
  revalidateTag('second', 'max')
  revalidateTag('third', 'max')

  setTimeout(() => {
    globalThis.platformatic.events.emitAndNotify('revalidated')
  }, 100)

  return Response.json({ ok: true })
}
