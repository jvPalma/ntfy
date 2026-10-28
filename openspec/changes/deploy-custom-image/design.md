# Design

## Context

- `Dockerfile-build` already builds docs, web and Go in one multi-stage image and accepts `VERSION` and `COMMIT` build args (`Dockerfile-build:3-4,59`). Without them it reports `dev` / `unknown`. `Makefile` derives `VERSION` from `git describe --tag`, but this clone has no tags.
- `.dockerignore` excludes only `dist`, `*/node_modules`, `Dockerfile*`. A build with `~/projects/ntfy` as context would ship whatever uncommitted work is on disk.
- `GET /v1/version` is admin-only (`server.go:692-693`, `server_admin.go:13-19`). The startup log prints `BuildVersion` (`server.go:439`).
- Named time zones work without Alpine `tzdata` because `main.go:7` embeds `time/tzdata`, so the `TZ` in `apps/ntfy/.env` keeps working on the `Dockerfile-build` runtime stage, which has no `apk add tzdata`.
- The homelab's `docker-compose.1102x.yml` also holds `build:` services (MinerU, ~25 GB). `CLAUDE.md` there documents `up -d --build <service>`; a bare `up --build` would rebuild them all.
- Homelab scripts (`apps/ntfy/scripts/*.sh`) reach the server by container name `jvpalma-ntfy` and publish with `curl -s`, no retry.

## Goals / Non-Goals

**Goals:**
- One command turns a commit into `ntfy-jv:<shortsha>` without touching production.
- The swap and rollback are single-line, single-service operations.

**Non-Goals:**
- A registry, CI, or automatic deploys.
- Changing `Dockerfile-build` or server code.
- Metrics or an out-of-band "ntfy is down" alert (follow-ups in the brief).

## Decisions

1. **Build outside compose, pin `image:` in compose.** `scripts/jv-image.sh <rev>` runs `docker build`; compose only references the tag.
   - Alternative: a compose `build:` block pointing at `~/projects/ntfy`. Rejected: it builds the dirty working tree, overwrites one tag on every build (no rollback to the previous fork build), and couples the build to `up`.
2. **Clean source via `git archive`.** The script exports `<rev>` into a temp dir with `git archive <rev> | tar -x -C <tmp>` and builds there, then deletes the temp dir. `git archive` is read-only and needs no worktree.
   - Alternative: `git worktree add`. Rejected: it writes to `.git` (the owner reserves all git writes).
3. **Version string.** `VERSION=<upstream>-jv`, where `<upstream>` is the last upstream release the fork is based on, kept as `UPSTREAM_VERSION=2.34.0` at the top of the script (bump it when merging an upstream release). `COMMIT=<shortsha>`. The script prints both.
   - Alternative: `git describe`. Rejected: no tags in this clone, and fetching them is a git write.
4. **Script refuses to deploy.** It only builds and tags. The `image:` edit and `docker compose ... up -d --no-deps ntfy` stay manual, in the runbook, so a build can never restart production.
5. **Runbook in `scripts/jv-fork-deploy.md`, next to the script.** Not under `docs/`: `make docs-build` publishes every file there to `/docs` on the public server, which would expose homelab paths.

## Risks / Trade-offs

- [Alerts lost during the restart, ~5–10 s] → Accepted; deploy when no scheduled job runs (check `crontab -l` for the ntfy scripts' times).
- [Upstream merge adds a schema migration, making rollback to an older image unsafe] → Runbook step: before each deploy, `git log <deployed-sha>..<new-sha> -- '*.go' | grep -i migrat` and read any hit; back up first.
- [Disk use from kept images, each ~60–80 MB] → Keep the last 3 `ntfy-jv:*` tags; runbook includes the prune command for older ones.
- [Build needs network (nodesource, pip, npm, Go modules)] → A failed build leaves production untouched (spec "A failed build does not touch production").
- [Docs build in `Dockerfile-build` adds minutes] → Accepted; the image serves `/docs` like upstream.

## Migration Plan

1. Stop `jvpalma-ntfy`, copy `apps/ntfy/data/` (including `attachments/`) to `data.bak-<date>`, start it again.
2. `scripts/jv-image.sh HEAD` → `ntfy-jv:<shortsha>`.
3. Edit the `ntfy` service `image:` line; `docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy`.
4. Smoke test (spec scenarios).
5. Rollback: restore the previous `image:` line and repeat step 3's `up` command.
