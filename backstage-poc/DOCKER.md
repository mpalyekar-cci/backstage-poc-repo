# Building and Running Backstage with Docker

This app is set up for the **host build** approach as recommended in the [Backstage Docker deployment guide](https://backstage.io/docs/deployment/docker).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with BuildKit enabled (`DOCKER_BUILDKIT=1`, default in recent Docker)
- [Node.js](https://nodejs.org/) 22 or 24
- [Yarn](https://yarnpkg.com/) (v4 via this repo’s `.yarnrc.yml`)

Before containerizing, you should:

1. **Use a real auth provider** – The default Guest provider is not intended for containerized environments. See the [Authentication guide](https://backstage.io/docs/auth/).
2. **Use PostgreSQL in production** – `app-config.production.yaml` is already configured for Postgres via `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.

## Build the image (host build)

From the **root of this repo** (`backstage-poc/`):

```bash
# One-shot: install, type-check, build backend, then build Docker image
yarn docker:build
```

Or step by step:

```bash
yarn install --immutable
yarn tsc
yarn build:backend
docker image build . -f packages/backend/Dockerfile --tag backstage
```

Alternatively, after running the first three commands yourself, you can use:

```bash
yarn build-image
```

## Push image to remote registry

Tag and push the built image to Docker Hub (log in first with `docker login`):

```bash
# Push with latest tag
yarn docker:push
```

Or with a specific tag:

```bash
docker tag backstage mohitpalyekarcci/backstage-poc-registry:<tagname>
docker push mohitpalyekarcci/backstage-poc-registry:<tagname>
```

## Run the container

The production config expects **PostgreSQL**. If you run the image alone without passing database env vars, the backend will try to connect to `127.0.0.1:5432` inside the container and fail with `ECONNREFUSED`.

### Option A: Docker Compose (recommended for local)

Runs Backstage + PostgreSQL together so the app can connect to the DB:

```bash
# 1. Build the image once
yarn docker:build

# 2. Start Postgres + Backstage
yarn docker:up
```

Then open **http://localhost:7007**. Stop with `Ctrl+C` or run `yarn docker:down`.

**GitHub sign-in:** For “Sign in with GitHub” to work in Docker, pass the same OAuth credentials you use for `yarn start`. Either:

- Create a `.env` file next to `docker-compose.yml` with:
  - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (from your [GitHub OAuth App](https://github.com/settings/developers))
- Or run: `GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... yarn docker:up`

The **Authorization callback URL** in your GitHub OAuth App must match the Docker app URL, e.g. `http://localhost:7007/api/auth/github/handler/frame` (and `http://localhost:7007` as Homepage URL if required). With `yarn start` the frontend is on port 3000 but the auth callback still goes to the backend (7007), so the same callback URL works for both.

### Option B: Run image alone (you must provide Postgres)

```bash
yarn docker:run
```

Or with your own database and auth env vars (required to avoid 401 Unauthorized):

```bash
docker run -it -p 7007:7007 \
  -e POSTGRES_HOST=your-db-host \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=backstage \
  -e POSTGRES_PASSWORD=secret \
  -e BACKEND_SECRET=your-secret-for-signing \
  backstage
```

Then open **http://localhost:7007**.

For production, pass Postgres and a strong `BACKEND_SECRET` (and any other env vars) and do not use the default secret from docker-compose.

## Troubleshooting

- **401 Unauthorized from the frontend:** The backend needs `BACKEND_SECRET` to sign auth cookies/tokens. Use Docker Compose (`yarn docker:up`), or pass `-e BACKEND_SECRET=your-secret` when running the image alone.

- **GitHub sign-in fails in Docker but works with `yarn start`:** Ensure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are passed into the container (e.g. via a `.env` file next to `docker-compose.yml` or `-e` when using `docker run`). In Docker Compose they are read from the host environment. Also confirm your GitHub OAuth App’s callback URL is `http://localhost:7007/api/auth/github/handler/frame` (or your actual backend base URL).

- **More verbose build output:**  
  `docker image build . -f packages/backend/Dockerfile --tag backstage --progress=plain`

- **Rebuild without cache:**  
  Add `--no-cache` to the `docker image build` command.

- **Permission denied on `packages/`:**  
  Ensure BuildKit is enabled: `DOCKER_BUILDKIT=1` (default in recent Docker).

## Multi-stage build

If you need to build **entirely inside Docker** (e.g. no host Node), see [Multi-stage Build](https://backstage.io/docs/deployment/docker#multi-stage-build) in the Backstage docs. That uses a different root `Dockerfile` and `.dockerignore`.
