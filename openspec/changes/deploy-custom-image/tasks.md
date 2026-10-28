# Tasks

## 1. Build script

- [x] 1.1 Add `scripts/jv-image.sh <rev>`: resolve `<rev>` with `git rev-parse --verify`, exit non-zero with a message if it does not exist; `git archive <rev> | tar -x` into a `mktemp -d` dir removed on exit (`trap`); `docker build -f Dockerfile-build --build-arg VERSION=${UPSTREAM_VERSION}-jv --build-arg COMMIT=<shortsha> -t ntfy-jv:<shortsha> <tmp>`; `UPSTREAM_VERSION=2.34.0` constant at the top with a comment to bump on upstream merges; `set -euo pipefail`; print VERSION, COMMIT and the export's file count before building. Verify: `bash -n scripts/jv-image.sh` passes and `scripts/jv-image.sh does-not-exist` exits non-zero before any `docker` call.
- [x] 1.2 Build the current revision: `scripts/jv-image.sh HEAD`. Verify: `docker images ntfy-jv` lists `ntfy-jv:<shortsha>`; `docker run --rm ntfy-jv:<shortsha> --help` prints the ntfy help; with an untracked file `web/src/DIRTY` present, the script's temp export does not contain it (the script prints the export's file count, which equals `git ls-tree -r --name-only <rev> | wc -l`).
- [x] 1.3 Check the version locally: `docker run --rm -p 18080:80 ntfy-jv:<shortsha> serve --base-url http://localhost:18080` and read the first log line. Verify: it shows `ntfy 2.34.0-jv`.

## 2. Runbook

- [x] 2.1 Write `scripts/jv-fork-deploy.md`: backup with the container stopped (including `attachments/`), migration check (`git log <deployed>..<new> -- '*.go'` grep for migrations), build, `image:` edit, `docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy` (with a warning never to run a bare `up --build` on that file), smoke test, rollback to previous fork build and to `binwiederhier/ntfy:v2.34.0`, keep the last 3 `ntfy-jv:*` images and how to remove older ones. Verify: every command in the file is copy-pasteable and uses real paths from `~/jvpalma-homelab`.

## 3. Production swap (owner present)

- [x] 3.1 Back up: `docker stop jvpalma-ntfy`, copy `~/jvpalma-homelab/apps/ntfy/data` to `data.bak-<YYYYMMDD>`, `docker start jvpalma-ntfy`. Verify: the backup has `auth.db`, `cache.db` and `attachments/`, and the container is healthy again.
- [x] 3.2 In `~/jvpalma-homelab/docker-compose.1102x.yml`, change the `ntfy` service `image: binwiederhier/ntfy:v2.34.0` to `image: ntfy-jv:<shortsha>`; no other line changes. Run `docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy`. Verify: `docker ps --filter name=jvpalma-ntfy` shows the new image and `(healthy)` within 2 minutes.
- [x] 3.3 Smoke test: `docker logs jvpalma-ntfy | grep Listening` shows `2.34.0-jv`; `curl -u <admin> https://ntfy.jvpalma.com/v1/version` returns the commit; publish to a protected topic with an existing token and confirm on the phone; open `https://ntfy.jvpalma.com` and see existing subscriptions and messages.
- [x] 3.4 Rollback drill: set `image:` back to `binwiederhier/ntfy:v2.34.0`, `up -d --no-deps ntfy`, confirm healthy, then set it to `ntfy-jv:<shortsha>` again. Verify: both transitions end healthy and the phone still receives a test message.
