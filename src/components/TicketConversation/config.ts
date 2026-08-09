/**
 * Ticketing feature flags — re-export of the shared implementation.
 *
 * The flags used to be defined (twice, byte-for-byte) here and in
 * `views/shared/config.ts`, each reading `localStorage` directly. The single
 * implementation now lives in `utils/features.ts` and is backed by the server;
 * both modules are kept as import sites so existing paths keep working.
 */
export {
  DEFAULT_TICKETING_FEATURES,
  DEFAULT_TICKETING_FEATURES as DEFAULT_FEATURES,
  FEATURES_CACHE_KEY,
  fetchFeatures,
  getFeatures,
  normalizeFeatures,
  saveFeatures,
} from '../../utils/features'
export type { TicketingFeatures } from '../../utils/features'
