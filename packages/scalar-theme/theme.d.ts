export interface ScalarTheme {
  /** The Platformatic Scalar theme CSS, passed to @scalar/fastify-api-reference's configuration.customCss. */
  theme: string
}

declare const scalarTheme: ScalarTheme

export default scalarTheme
