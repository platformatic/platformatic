export declare const SCHEDULER_MANIFEST_FILENAME: string

export default function schedulerModule (nitro: {
  options: Record<string, any>
  hooks: { hook: (name: string, handler: (...args: any[]) => unknown) => void }
}): void
