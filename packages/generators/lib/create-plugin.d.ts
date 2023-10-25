import type FileObject from './file-generator'

type HelperCustomization = {
  pre: string
  post: string
  config: string
  requires: string
}

export function generatePluginWithTypesSupport(typescript: boolean)
export function generateRouteWithTypesSupport(typescript: boolean)
export function generateTests(typescript: boolean, type: string, customization?: HelperCustomization): Array<FileObject>
export function generatePlugins(typescript: boolean): Array<FileObject>