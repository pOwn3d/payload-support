/**
 * Ticketing feature flags — re-export of the shared implementation.
 *
 * See `utils/features.ts`. This module is kept so that
 * `views/shared/index.ts` and existing view imports keep resolving.
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
