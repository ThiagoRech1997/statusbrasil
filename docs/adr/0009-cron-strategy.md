# 0009. Cron strategy for Gatus → Postgres aggregates

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

ADR-0003 made Gatus the source of truth for raw probe data and ADR-0004 made Postgres the home for hourly aggregates. The remaining question is *who pulls the trigger*: something has to call `POST /api/cron/aggregate` once an hour so that `service_uptime_hourly` rolls forward and incidents reconcile (TFR-141).

The realistic options were:

- **In-process scheduler** (`node-cron` or `setInterval` inside the Next.js server). Zero infra, but it ties scheduling to a single web replica, fires while serving traffic, dies on every redeploy, and disappears entirely on serverless / multi-replica deployments. It also makes the trigger invisible to the operator — there is no audit trail outside application logs.
- **GitHub Actions `schedule:`** workflow that `curl`s the endpoint. The trigger lives in the repo, is auditable in the Actions tab, and is decoupled from the runtime. The cost is GitHub's well-documented schedule jitter: the [Actions docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) say cron runs are best-effort and may be delayed during high load — anecdotally 30–90 minutes is not unusual, and runs can be skipped entirely when the queue is saturated.
- **systemd timer on the same host as the Next.js app** (reached over SSH, or co-located on the VM that runs the standalone build). Tightest schedule fidelity and no third-party dependency, but it adds a host-level config surface that has to be managed alongside the Docker deployment and is invisible to anyone who only looks at the repo.
- **External cron-as-a-service** (Cron-Job.org, EasyCron, Upstash QStash). Reliable, but pulls another vendor and another secret into the loop for a job that's already 90% solved by GitHub.

For M1, we care more about *visibility and zero ops* than about minute-perfect punctuality. Aggregates are hourly; an aggregate that lands 45 minutes late is still strictly better than no aggregate. The endpoint is idempotent (`runAggregation` upserts by `(service_id, hour)`), so a missed run is recovered by the next run rather than producing a gap.

## Decision

**GitHub Actions is the cron trigger for `/api/cron/aggregate`.** A single workflow at `.github/workflows/cron.yml` runs `5 * * * *` on `main`, `POST`s to `${vars.PROD_URL}/api/cron/aggregate` with the `X-Cron-Secret` header sourced from `secrets.CRON_SECRET`, logs the HTTP status and body, and fails the job on any non-200 response.

The endpoint already enforces auth, rate-limits bad-secret attempts, and returns a JSON summary (services processed, hours aggregated, incidents opened/closed, duration). The workflow's job is purely to fire it on time and surface failures via the GitHub Actions UI.

`workflow_dispatch` is enabled so an operator can trigger the run on demand (e.g. after a deploy or to backfill a missed slot). `concurrency: cron-aggregate` with `cancel-in-progress: false` prevents a long aggregation from being interrupted by the next scheduled tick while still serializing overlapping runs.

## Consequences

- **Easier:** the trigger is in the repo, reviewed via PR, observable in the Actions tab, and survives redeploys. No new infrastructure to operate and no new secret in any third-party service. Local development is unaffected — the scheduler simply doesn't run, which is the desired behavior for a dev box.
- **Harder:** scheduled runs can drift 30–90 minutes under GitHub load and very occasionally are skipped. The 5-minute offset gives Gatus time to settle the previous hour but does not insulate us from GHA jitter. The `freshness` indicator surfaced in the UI must therefore reflect the *actual* `aggregated_at` timestamp from Postgres, not an assumed "must be within the last hour" — see TFR-141 for the reconcile job and the staleness signal.
- **Committed to:** GitHub Actions as the only scheduled trigger for M1, idempotency on the endpoint side as the safety net for missed/late runs, and `secrets.CRON_SECRET` + `vars.PROD_URL` as the contract between the workflow and the deployed app.
- **Plan B (deferred, not implemented):** if observed freshness regresses past one hour with any regularity once we have real traffic, replace the GHA workflow with a `systemd` timer on the same VM as the Next.js standalone server. The unit would `curl` `http://127.0.0.1:3000/api/cron/aggregate` (no public hop, no third-party scheduler), reusing the same secret-checked endpoint contract. A future ADR would supersede this one if we make that switch.
