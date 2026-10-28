## Purpose

Defines how a commit of the ntfy jv fork becomes a Docker image the homelab can run, how that image identifies itself, and the guarantees for swapping it into production and rolling it back.

## ADDED Requirements

### Requirement: Image built from a committed revision
The fork image SHALL be built only from a committed revision of the repository, never from uncommitted files in a working tree. The image tag SHALL be `ntfy-jv:<shortsha>`, where `<shortsha>` is the short hash of that revision, so each build has its own tag.

#### Scenario: Uncommitted edits are not shipped
- **WHEN** the working tree has uncommitted changes and the owner builds revision `HEAD`
- **THEN** the image contains the files of `HEAD` as committed and none of the uncommitted changes

#### Scenario: Each revision gets its own tag
- **WHEN** the owner builds revision `a1b2c3d` and later revision `e4f5a6b`
- **THEN** both `ntfy-jv:a1b2c3d` and `ntfy-jv:e4f5a6b` exist locally and the first is not overwritten

#### Scenario: Unknown revision
- **WHEN** the owner asks to build a revision that does not exist in the repository
- **THEN** the build stops with an error before Docker runs and no image is tagged

### Requirement: Image reports its version and commit
A running fork image SHALL report a version of the form `<upstream-version>-jv` and the commit it was built from, in the startup log and in the admin version endpoint (`GET /v1/version`). It SHALL NOT report `dev` or `unknown`.

#### Scenario: Startup log
- **WHEN** the container starts
- **THEN** the log line `Listening on ..., ntfy <version>` shows a version ending in `-jv`

#### Scenario: Version endpoint
- **WHEN** an admin calls `GET /v1/version`
- **THEN** the response has `version` ending in `-jv` and `commit` equal to the short hash in the image tag

### Requirement: Drop-in replacement for the official image
The fork image SHALL run with the existing homelab configuration unchanged: the same env file, data volume, container name `jvpalma-ntfy`, port mapping and healthcheck. Existing users, access tokens, topics, cached messages and attachments SHALL keep working.

#### Scenario: Healthy after the swap
- **WHEN** the `ntfy` service is switched to `ntfy-jv:<shortsha>` and started
- **THEN** the existing healthcheck (`/v1/health` reports `healthy: true`) passes and `docker ps` shows the container as healthy

#### Scenario: Existing token still publishes
- **WHEN** a homelab script publishes to a protected topic with an existing access token
- **THEN** the server accepts the message and the owner's phone receives it

### Requirement: Rollback is one line
Going back to the previous fork build, or to the official image, SHALL require changing only the `image:` value of the `ntfy` service and recreating that one service, as long as no schema migration was applied in between.

#### Scenario: Back to the previous fork build
- **WHEN** the owner sets `image:` to the previous `ntfy-jv:<shortsha>` and recreates the service
- **THEN** the previous build runs on the same data and is healthy

#### Scenario: Back to upstream
- **WHEN** the owner sets `image: binwiederhier/ntfy:v2.34.0` and recreates the service, and no deployed fork build added a schema migration
- **THEN** the official image runs on the same data and is healthy

### Requirement: A failed build does not touch production
Building an image SHALL NOT stop, recreate or modify the running `jvpalma-ntfy` container or any other homelab service.

#### Scenario: Build fails
- **WHEN** the image build fails (for example a web or Go compile error, or a network error while installing dependencies)
- **THEN** `jvpalma-ntfy` keeps running its current image and no `ntfy-jv` tag points to a broken image
