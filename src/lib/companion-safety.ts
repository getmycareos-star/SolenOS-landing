export interface CompanionSafetySignal {
  safety_note?: string | null
  reply?: string | null
}

/**
 * Only backend-classified emergency language should activate the emergency UI.
 * A generic "blocked" verdict also covers missing evidence and uncertainty.
 */
export function isEmergencyCompanionResponse(response: CompanionSafetySignal): boolean {
  const safetyNote = String(response.safety_note ?? '').toLowerCase()
  const reply = String(response.reply ?? '').trim().toLowerCase()

  return (
    safetyNote.includes('possible emergency language detected') ||
    safetyNote.includes('urgent human assessment is needed') ||
    reply.startsWith('this may be an emergency.')
  )
}
