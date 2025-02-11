export async function middleware() {
  const res = await fetch('http://service-1.plt.local/hello')
  const data = await res.json()

  return Response.json(
    { success: true, message: 'middleware', status: res.status, data },
    { status: 200 }
  )
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
