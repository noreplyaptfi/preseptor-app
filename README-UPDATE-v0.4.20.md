# Update v0.4.19 → v0.4.20

## Capacity Guard Lifecycle Hotfix

Fixes a database-level quota mismatch where the admin dashboard counted only active registrations, but the PostgreSQL capacity trigger still counted withdrawn/rejected rows.

### Symptom

Example:
- Online active: 179
- Online quota: 182
- Rejected Online: 2
- Withdrawn Online: 1

Dashboard correctly shows 179/182, but INSERT can fail with `quota_online_full` because the old trigger sees all 182 Online rows.

### New rule

Only these lifecycle statuses consume capacity:
- `active`
- `withdrawal_requested`

These do not consume capacity:
- `withdrawn`
- `rejected`

The INSERT and UPDATE capacity guard functions are both aligned with the same rule.

## Install

Baseline: v0.4.19

No npm install is required.

Run only this migration in Supabase SQL Editor:

`supabase/migrations/015_fix_capacity_guard_lifecycle.sql`

No app files are changed.

## Test

1. Confirm active Online is below `quota_online`.
2. Re-import only a previously failed special participant row.
3. It should succeed while a slot is available.
4. Confirm active Online increments by 1.
5. Confirm rejected/withdrawn rows remain excluded from quota.
6. When active Online actually reaches the quota, the next Online insert must fail with `quota_online_full`.

Do not re-import the whole successful batch; retry only failed rows.
