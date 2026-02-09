import { revalidateTag } from 'next/cache'

export const revalidate = 120

export async function GET () {
  revalidateTag('first', 'max')
  revalidateTag('second', 'max')
  revalidateTag('third', 'max')
  return Response.json({ ok: true })
}
