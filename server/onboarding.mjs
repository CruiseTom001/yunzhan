export const CURRENT_TOUR_VERSION = 1

export function toOnboardingResponse(row) {
  return {
    status: row.onboarding_status,
    version: row.onboarding_version,
    stepId: row.onboarding_step ?? null,
    updatedAt: row.onboarding_updated_at
      ? new Date(row.onboarding_updated_at).getTime()
      : null,
    tourVersion: CURRENT_TOUR_VERSION,
  }
}

export async function fetchOnboardingState(client, userId) {
  const result = await client.query(
    `SELECT onboarding_status, onboarding_version, onboarding_step, onboarding_updated_at
       FROM users
      WHERE id = $1`,
    [userId],
  )
  return result.rows[0] ?? null
}
