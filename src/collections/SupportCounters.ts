import type { CollectionConfig } from 'payload'

export function createSupportCountersCollection(slug = 'support-counters'): CollectionConfig {
  return {
    slug,
    admin: { hidden: true },
    access: { create: () => false, read: () => false, update: () => false, delete: () => false },
    fields: [
      { name: 'key', type: 'text', required: true, unique: true, index: true },
      { name: 'nextValue', type: 'number', required: true, min: 1 },
    ],
    timestamps: false,
  }
}
