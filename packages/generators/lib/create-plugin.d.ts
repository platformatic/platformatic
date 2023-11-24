import { FileGenerator } from './file-generator'

type HelperCustomization = {
  pre: string
  post: string
  config: string
  requires: string
}

export function generatePluginWithTypesSupport(typescript: boolean): FileGenerator.FileObject
export function generateRouteWithTypesSupport(typescript: boolean): FileGenerator.FileObject
export function generateTests(typescript: boolean, type: string, customization?: HelperCustomization): Array<FileGenerator.FileObject>
export function generatePlugins(typescript: boolean): Array<FileGenerator.FileObject>