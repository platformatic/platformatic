import { BaseLogger } from 'pino'

export type FileGeneratorOptions = {
  logger?: BaseLogger
}

type FileObject = {
  path: string,
  file: string,
  contents: string
}

class FileGenerator {
  files: FileObject[]
  targetDirectory: string

  constructor(opts?: FileGeneratorOptions)

  setTargetDirectory(dir: string): void
  addFile(file: FileObject): void
  appendfile(file: FileObject): void
  reset(): void
  async writeFiles(): void
  listFiles(): FileObject
  getFileObject(file: string, path?: string): FileObject
}

export { FileGenerator }