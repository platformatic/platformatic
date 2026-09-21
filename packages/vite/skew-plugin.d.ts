import type { Plugin } from 'vite'

export declare function addDeploymentId (url: string, deploymentId: string): string
export declare function platformaticSkewPlugin (deploymentId?: string): Plugin | undefined
export declare const skewPlugin: typeof platformaticSkewPlugin
export declare const deploymentIdEnv: 'PLT_DEPLOYMENT_ID'
export default platformaticSkewPlugin
