import { onEntrypointRequest } from '@platformatic/basic'

// A TypeScript worker extension, to prove Node type stripping loads it. It uses
// a named `setup` export rather than a default one, covering both forms.
export function setup (): void {
  onEntrypointRequest(({ addResponseHeader }: { addResponseHeader: (n: string, v: string) => void }) => {
    addResponseHeader('x-ts-extension', 'ok')
  })
}
