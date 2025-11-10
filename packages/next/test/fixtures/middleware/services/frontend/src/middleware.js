// This is used by Next 14 and 15
export async function middleware () {
  const res = await fetch('http://service-1.plt.local/hello')
  const data = await res.json()

  return Response.json({ success: true, message: 'middleware', status: res.status, data }, { status: 200 })
}

// This is used by Next 16+
export const proxy = middleware

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)']
}
