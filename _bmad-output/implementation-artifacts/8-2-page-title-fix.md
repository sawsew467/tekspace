# Story 8-2: Page Title Fix

**Epic:** 8 — UX Polish & Feature Completeness
**Story Key:** 8-2-page-title-fix
**Status:** done

---

## Story

As a user,
I want the browser tab to show the correct page name when I navigate between pages,
So that I can identify the current page at a glance without needing to look at the app UI.

---

## Acceptance Criteria

**AC1 — Default title fallback:**
Given user opens TekSpace for the first time (root route, any unmatched route, or sign-in)
Then browser tab shows `"TekSpace"` as the default title.

**AC2 — Per-route title updates:**
Given user navigates to any authenticated route (dashboard, schedule, notifications, etc.)
Then browser tab immediately updates to show the route-specific title (e.g., `"Team Dashboard — TekSpace"`)
And title updates without requiring a page refresh.

**AC3 — HeadContent renders meta tags:**
Given TanStack Router routes define `head: () => ({ meta: [{ title: '...' }] })`
Then `<HeadContent />` in `__root.tsx` renders those meta tags into the document `<head>`
And the browser tab reflects the correct title for each route.

---

## Tasks / Subtasks

- [x] **Task 1:** Add `<HeadContent />` to `__root.tsx`
  - [x] 1.1 Import `HeadContent` from `@tanstack/react-router`
  - [x] 1.2 Add `head()` to the root route with default title `'TekSpace'`
  - [x] 1.3 Render `<HeadContent />` inside the root component

- [x] **Task 2:** Verify all routes have `head()` defined
  - [x] 2.1 Audit all route files for existing `head()` definitions

---

## Dev Notes

### Technical Context
- TanStack Router v1.141+ uses `head()` in route definitions to set document meta tags
- `<HeadContent />` component (exported from `@tanstack/react-router`) renders the accumulated route head tags into the DOM
- Must be placed in `__root.tsx` component tree so it fires on every navigation
- Default title `'TekSpace'` is set in root `head()` — child routes override this
- All existing routes already have `head: () => ({ meta: [{ title: '...' }] })` defined

### Files to Modify
- `src/routes/__root.tsx` — add `HeadContent` + root `head()`

---

## Dev Agent Record

### Implementation Plan
- Add `HeadContent` import and render it in root component
- Add root `head()` with default title `'TekSpace'`
- No new dependencies needed

### Completion Notes
- ✅ Added `HeadContent` from `@tanstack/react-router` to `__root.tsx`
- ✅ Added root `head()` with fallback title `'TekSpace'`
- ✅ Rendered `<HeadContent />` in root component tree
- ✅ All 15 existing routes already have `head()` defined — no additional changes needed
- ✅ Implementation enables browser tab title to update on navigation

---

## File List

- `src/routes/__root.tsx` — modified

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story created and implemented — HeadContent added to __root.tsx |
