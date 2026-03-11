# Live Smoke Scope

## Use live smoke for

- Guest signup and booking flow
- Inquiry / messaging flow
- Host dashboard actions that need runtime proof
- Admin dashboard checks when UI state matters

## Avoid in live smoke unless explicitly requested

- Wide full-ecosystem scenarios when a narrower spec already exists
- Destructive admin actions without clear need
- Bulk cleanup or broad data mutation

## Existing patterns

- Use unique guest account generation
- Reuse service-role Supabase reads already embedded in the spec
- Prefer a single end-to-end check over many loosely connected actions
