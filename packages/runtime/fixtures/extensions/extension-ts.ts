interface ExtensionContext {
  itc: {
    handle (name: string, handler: (payload: unknown) => unknown): void
  }
  options: Record<string, unknown>
}

export default async function setup ({ itc, options }: ExtensionContext): Promise<void> {
  itc.handle('extension:ts', (): Record<string, unknown> => {
    return { language: 'typescript', options }
  })
}
