# Proposal

## Why

`ntfy.jvpalma.com` runs the official image `binwiederhier/ntfy:v2.34.0`, so nothing built in this fork can reach the owner. The next three changes (`web-message-rendering`, `web-dgsl-design-system`, `web-topic-groups`) all need a repeatable way to build this repo into an image and swap it into the homelab, with a one-line rollback. Doing this first, with no UI change, proves the pipeline while the risk is lowest: `HEAD` is 5 commits after `v2.34.0`, changes 7 Go files and adds no schema migration.

## What Changes

- Add a build script that exports a given commit with `git archive` (read-only, never the dev working tree), builds it with `Dockerfile-build`, passes `VERSION` and `COMMIT`, and tags the result `ntfy-jv:<shortsha>`.
- Switch the `ntfy` service in `~/jvpalma-homelab/docker-compose.1102x.yml` from `image: binwiederhier/ntfy:v2.34.0` to `image: ntfy-jv:<shortsha>`. Container name, port, env file, volumes and healthcheck stay as they are.
- Document the deploy and rollback runbook: stopped-container backup including `attachments/`, single-service `up -d --no-deps ntfy`, smoke test, per-deploy schema-migration check, and rollback to a previous fork build or to upstream.
- No change to server behaviour or to the web app.

## Capabilities

### New Capabilities
- `fork-image-build`: how a commit of this fork becomes a deployable, identifiable image, and the guarantees the owner relies on when swapping and rolling it back.

### Modified Capabilities
<!-- none: no living specs exist yet -->

## Impact

- New: `scripts/jv-image.sh`, `scripts/jv-fork-deploy.md` (runbook).
- Homelab (outside this repo, owner's machine): one `image:` line in `~/jvpalma-homelab/docker-compose.1102x.yml`; Docker images `ntfy-jv:*` kept locally.
- Production: a restart of `jvpalma-ntfy` of a few seconds. Publishers use `curl -s` without retry, so alerts sent during the restart are lost.
- No dependency, API or data-model change.
- Source: `openspec/brainstorms/2026-10-27-ntfy-jv-web-fork.md`.
