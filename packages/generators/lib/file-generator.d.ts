import { BaseLogger } from 'pino'

export namespace FileGenerator {
  export type FileGeneratorOptions = {
    logger?: BaseLogger
  }
  
  export type FileObject = {
    path: string,
    file: string,
    contents: string
  }
  
  export class FileGenerator {
    files: FileObject[]
    targetDirectory: string
  
    constructor(opts?: FileGeneratorOptions)
  
    setTargetDirectory(dir: string): void
    addFile(file: FileObject): void
    appendfile(file: FileObject): void
    reset(): void
    writeFiles(): Promise<void>
    listFiles(): FileObject
    getFileObject(file: string, path?: string): FileObject
  }
  
}
