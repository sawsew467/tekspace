# Story 8-3: Copy Invite Link

**Epic:** 8 — UX Polish & Feature Completeness
**Story Key:** 8-3-copy-invite-link
**Status:** done

---

## Story

As an owner or manager,
I want to copy the invite link for a pending invite directly from the invite list,
So that I can quickly share the link with the invitee via other channels without having to resend the email.

---

## Acceptance Criteria

**AC1 — Copy button visible for pending invites only:**
Given an invite has `status === 'pending'`
And user has `canManage = true`
Then a copy icon button is shown next to the "Gửi lại" button.

**AC2 — Copy button NOT shown for other statuses:**
Given an invite has `status === 'expired'`, `'accepted'`, `'revoked'`, or `'declined'`
Then no copy button is shown (expired invites have invalid tokens, accepted/revoked/declined are no longer actionable).

**AC3 — Clicking copy puts invite URL in clipboard:**
Given user clicks the copy icon
Then `${window.location.origin}/accept-invite?token=${invite.token}` is copied to clipboard
And a toast shows `"Đã copy link lời mời"`.

**AC4 — token is fetched from DB:**
Given `getInvites` fetches invite list
Then `token` column is included in the select query
And `TenantInvite` type includes `token: string`.

---

## Tasks / Subtasks

- [x] **Task 1:** Update `TenantInvite` type and `getInvites` query to include `token`
  - [x] 1.1 Add `token: string` to `TenantInvite` type in `tenant.service.ts`
  - [x] 1.2 Add `token` to the select string in `getInvites`

- [x] **Task 2:** Add copy button to `InviteListSection`
  - [x] 2.1 Import `Copy` icon from `lucide-react`
  - [x] 2.2 Add copy handler using `navigator.clipboard.writeText`
  - [x] 2.3 Render copy button only for `status === 'pending'` AND `canManage`
  - [x] 2.4 Show toast `"Đã copy link lời mời"` on success

---

## Dev Notes

### Technical Context
- `tenant_invites` table has a `token` column (text, NOT NULL)
- Invite URL format: `${window.location.origin}/accept-invite?token=${invite.token}`
- `navigator.clipboard.writeText()` is async — needs try/catch for environments without clipboard permission
- Only `pending` invites have valid/active tokens; expired invites have tokens that are past `expires_at`
- Copy button placement: before "Gửi lại" button (left side)

### Files to Modify
- `src/features/tenant/services/tenant.service.ts` — add `token` to type + query
- `src/features/tenant/components/InviteListSection.tsx` — add copy button

---

## Dev Agent Record

### Completion Notes
- ✅ Added `token: string` to `TenantInvite` type
- ✅ Added `token` to `getInvites` select query
- ✅ Added `Copy` icon button in `InviteListSection` for pending invites only
- ✅ Copy handler uses `navigator.clipboard.writeText` with error fallback toast
- ✅ Toast "Đã copy link lời mời" shown on success

---

## File List

- `src/features/tenant/services/tenant.service.ts` — modified
- `src/features/tenant/components/InviteListSection.tsx` — modified

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story created and implemented — copy invite link feature added |
