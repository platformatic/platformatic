export default function handler (_request, reply, dest, options) {
  return reply.from(dest, options)
}
