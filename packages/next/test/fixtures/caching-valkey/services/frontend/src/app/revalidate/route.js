import { revalidateTag } from 'next/cache'

export const revalidate = 120

export async function GET() {
  revalidateTag('first')
  revalidateTag('second')
  revalidateTag('third')
  return Response.json({ ok: true })
}
