/**
 * Ambient stub for '@payload-config'.
 * The host application provides the real config; this stub satisfies
 * TypeScript when the plugin is type-checked in isolation.
 */
declare module '@payload-config' {
  import type { SanitizedConfig } from 'payload'
  const config: Promise<SanitizedConfig>
  export default config
}
