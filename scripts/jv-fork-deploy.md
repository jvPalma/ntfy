# Deploy the "ntfy jv" image to the homelab

The build and deploy runbook for `ntfy.jvpalma.com`. The `ntfy` service lives in `~/jvpalma-homelab/docker-compose.1102x.yml` (container `jvpalma-ntfy`, port 11028). Data lives in `~/jvpalma-homelab/apps/ntfy/data`.

> **Never run `docker compose -f docker-compose.1102x.yml up -d --build` without a service name.** That file also builds other services, including MinerU (~25 GB). Always use `up -d --no-deps ntfy`.

## 1. Check for schema migrations

Rollback to an older image is only safe when no migration ran in between. List the Go changes since the deployed commit:

```bash
cd ~/projects/ntfy
DEPLOYED=$(docker inspect -f '{{.Config.Image}}' jvpalma-ntfy | sed -n 's/^ntfy-jv://p')   # empty on upstream
git log --oneline ${DEPLOYED:-9f1d2ea4}..HEAD -- '*.go' | grep -iE 'migrat|schema' || echo "no migration commits"
```

`9f1d2ea4` is upstream `v2.34.0`. Read every hit before you continue.

## 2. Build

Only committed work is built. Commit first.

```bash
cd ~/projects/ntfy
scripts/jv-image.sh HEAD        # prints VERSION, COMMIT and the tag, e.g. ntfy-jv:3cb7a98d
```

If the build fails, production is untouched.

## 3. Back up (container stopped)

```bash
docker stop jvpalma-ntfy
# Attachments are written by the container as root (mode 600), so copy as root through a container.
docker run --rm -v ~/jvpalma-homelab/apps/ntfy:/d alpine cp -a /d/data /d/data.bak-$(date +%Y%m%d)
docker start jvpalma-ntfy
ls ~/jvpalma-homelab/apps/ntfy/data.bak-$(date +%Y%m%d)   # auth.db cache.db attachments ...
```

## 4. Swap the image

Edit the `ntfy` service in `~/jvpalma-homelab/docker-compose.1102x.yml`. Change only the `image:` line:

```yaml
    image: ntfy-jv:<shortsha>
```

Then recreate only that service:

```bash
cd ~/jvpalma-homelab
docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy
docker ps --filter name=jvpalma-ntfy --format '{{.Image}} {{.Status}}'   # wait for "(healthy)", up to ~2 min
```

Alerts published during the few seconds of the restart are lost (`curl -s`, no retry).

## 5. Smoke test

```bash
docker logs jvpalma-ntfy 2>&1 | grep Listening                    # "ntfy 2.34.0-jv"
curl -s -u <admin-user> https://ntfy.jvpalma.com/v1/version        # "commit": "<shortsha>"
curl -s -H "Authorization: Bearer <token>" -d "jv deploy test" https://ntfy.jvpalma.com/<topic>
```

Check that the message reaches the phone. Open `https://ntfy.jvpalma.com` and confirm that the subscriptions and messages are there.

## 6. Roll back

Set `image:` back and recreate the service:

```yaml
    image: ntfy-jv:<previous-shortsha>      # previous fork build
    image: binwiederhier/ntfy:v2.34.0       # official image (only if step 1 found no migration)
```

```bash
cd ~/jvpalma-homelab && docker compose -f docker-compose.1102x.yml up -d --no-deps ntfy
```

If the data is damaged, stop the container, then restore `data.bak-<date>` over `data/`, then start the container again.

## 7. Clean up old images

Keep the last 3 fork builds:

```bash
docker images ntfy-jv --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | tail -n +4 | cut -f2 \
  | xargs -r -I{} docker rmi ntfy-jv:{}
```
