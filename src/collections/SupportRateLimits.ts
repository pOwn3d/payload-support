import type { CollectionConfig } from 'payload'

export function createSupportRateLimitsCollection(slug = 'support-rate-limits'): CollectionConfig {
  return {
    slug,
    admin: { hidden: true },
    access: {
      create: () => false,
      read: () => false,
      update: () => false,
      delete: () => false,
    },
    fields: [
      { name: 'key', type: 'text', required: true, unique: true, index: true },
      { name: 'count', type: 'number', required: true, min: 1 },
      { name: 'resetAt', type: 'date', required: true, index: true },
    ],
    timestamps: false,
  }
}
