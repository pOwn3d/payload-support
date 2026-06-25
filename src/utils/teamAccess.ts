import type { Payload } from 'payload'
import type { CollectionSlugs } from './slugs'
import { dbFind } from './db'

/** Team scoping is opt-in — off by default so existing installs are unaffected. */
export function isTeamScopingEnabled(): boolean {
  return process.env.SUPPORT_TEAM_SCOPING === '1' || process.env.SUPPORT_TEAM_SCOPING === 'true'
}

/** Resolve the team IDs an agent belongs to. */
export async function resolveAgentTeamIds(
  payload: Payload,
  slugs: CollectionSlugs,
  userId: number | string,
): Promise<Array<number | string>> {
  try {
    const teams = await dbFind(payload, slugs.supportTeams, {
      where: { members: { in: [userId] } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    return teams.docs.map((t) => (t as { id: number | string }).id)
  } catch {
    return []
  }
}
