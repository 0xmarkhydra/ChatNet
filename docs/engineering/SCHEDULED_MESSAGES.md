# Scheduled text messages (SOCCO-89)

Open the clock next to the Web/PWA chat composer. The queue uses the device's
local time for entry and display and sends an absolute UTC timestamp to the API.
Pending jobs are scoped to the conversation and currently open channel.

The job runs on the server even when the browser is closed. Pending jobs can be
rescheduled or cancelled. The backend checks membership, blocking, channel
availability and encryption again before sending. This version schedules only
plain text in eligible non-E2EE chats. Attachments, replies, mentions as metadata
and recurring schedules are out of scope.

Regression coverage includes time conversion, create/reschedule/cancel in the
dialog, and backend dispatch, authorization and idempotency with disposable data.
