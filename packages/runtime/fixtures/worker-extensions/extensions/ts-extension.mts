// A TypeScript worker extension, to prove Node type stripping loads it.
interface Ctx {
  onRequest: (h: (a: { addResponseHeader: (n: string, v: string) => void }) => void) => void
}

export default function setup ({ onRequest }: Ctx): void {
  onRequest(({ addResponseHeader }) => {
    addResponseHeader('x-ts-extension', 'ok')
  })
}
