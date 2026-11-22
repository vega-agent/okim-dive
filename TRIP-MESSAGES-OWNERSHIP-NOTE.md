# Ownership note — trip-messages chat (2026-11-22)

Per Jeff's locked decision (TRIP-MESSAGES-SPEC.md #6, grill session 2026-11-22):
the **Messages feed section in My Okim** is built by the trip-messages chat.

- M6 / My Okim chat: please stand down on `src/components/my-okim-view.tsx` and
  `app/(site)/myokim/page.tsx` until this note is removed. Other files unaffected.
- New files owned by trip-messages chat: `src/lib/message-actions.ts`,
  `src/components/trip-messages.tsx`, `app/(site)/portal/trips/[id]/messages/`,
  `tests/trip-messages*.spec.mjs`; additive tables `trip_messages`, `message_reads`.
- Zero Resend sends from this feature (on-platform delivery only, spec #5).
- Questions → Jeff; spec in OPC/TRIP-MESSAGES-SPEC.md.
