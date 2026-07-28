function reportAuxiliaryFailure(onAuxiliaryError, stage, error) {
  if (typeof onAuxiliaryError === 'function') {
    onAuxiliaryError(stage, error)
  }
}

export async function persistFeedbackStatus(client, input, dependencies) {
  const updated = await client.query(
    `UPDATE feedback
        SET status = $2
      WHERE id = $1
      RETURNING id, status`,
    [input.feedbackId, input.status],
  )
  if (updated.rowCount === 0) return null

  let seenAt = null
  if (input.status !== 'open') {
    try {
      const seenResult = await client.query(
        `UPDATE feedback
            SET seen_at = COALESCE(seen_at, NOW())
          WHERE id = $1
          RETURNING seen_at`,
        [input.feedbackId],
      )
      seenAt = seenResult.rows[0]?.seen_at ?? null
    } catch (error) {
      reportAuxiliaryFailure(dependencies.onAuxiliaryError, 'seen_at', error)
    }
  }

  try {
    await dependencies.writeAudit(
      client,
      input.actorUserId,
      'feedback.update',
      input.actorUserId,
      {
        feedbackId: String(input.feedbackId),
        status: input.status,
      },
    )
  } catch (error) {
    reportAuxiliaryFailure(dependencies.onAuxiliaryError, 'audit', error)
  }

  return {
    id: updated.rows[0].id,
    status: updated.rows[0].status,
    seenAt,
  }
}
