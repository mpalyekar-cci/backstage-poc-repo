# Debugging catalog (GitHub URL locations)

## Why you still see a location or “host” after removing it from config (cache / volume)

**Catalog state is persisted in the database.** Removing a location from `catalog.locations` in `app-config.yaml` (or production config) only stops that location from being **re-registered** on the next startup. It does **not** remove:

- The **location** entity already stored in the database
- Any **entities** (components, templates, etc.) that were registered from that location

So the frontend (e.g. host dropdown, locations list, or entity list) can still show the old data until you clear it.

**Where it’s stored**

- **Docker:** PostgreSQL data is in the named volume `postgres_data` (see `docker-compose.yml`). That volume persists across `docker compose down` and restarts.
- **Local dev:** With `database.client: better-sqlite3` and `connection: ':memory:'`, the catalog is in memory and is cleared when you stop the backend (no volume).

**How to clear it**

1. **Remove the location via the UI (recommended):**  
   Go to **Admin** → **Catalog** → **Locations**, find the location you removed from config (e.g. the old host/URL), open it and use **Unregister** / **Delete** if available. That removes the location and its entities from the database.

2. **Full reset when using Docker:**  
   To wipe all catalog (and other) data and start fresh:
   ```bash
   docker compose down -v
   ```
   The `-v` removes the `postgres_data` volume. Next `docker compose up` will create a new DB and only register locations that are currently in your config.

3. **Browser:**  
   If the UI still shows old options, do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear site data for the Backstage origin (e.g. `http://localhost:3000`).

---

If entities from the GitHub catalog location are not showing:

## 0. Check startup logs

When the backend starts, it now logs:

- **`[catalog] Catalog locations in config: N`** – number of locations
- **`[catalog] [i] type=url target=...`** – each location (look for the GitHub URL)
- **`GITHUB_TOKEN (or integrations.github token) is set`** or **`GITHUB_TOKEN not set - GitHub URL locations may fail`**

If you run with **Docker**, you also get:

- **`[catalog] GITHUB_TOKEN is set (length=N)`** or **`[catalog] WARNING: GITHUB_TOKEN is not set`**

So you should always see at least these lines in the backend terminal. If you see no logs at all, the backend may not be starting (check the process and port 7007).

## 1. Set GITHUB_TOKEN (required for private repos)

The catalog fetches `https://raw.githubusercontent.com/CreativeCapsule-IT/cc-backstage-terraform-catalogs/...` using the GitHub integration. If the repo is private or you hit rate limits, you must set a Personal Access Token.

```bash
export GITHUB_TOKEN=ghp_your_token
yarn start
```

Or put the token in `app-config.local.yaml` (do not commit):

```yaml
integrations:
  github:
    - host: github.com
      token: ghp_your_token
```

**Token scopes:** at least `repo` for private repo read access. Create at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

## 2. Check locations in the UI

1. Open **Admin** → **Catalog** → **Locations** (or `/catalog` and use the admin/cog).
2. Find the location for `raw.githubusercontent.com/.../catalog-info.yaml`.
3. If it shows an error (e.g. 404, 403), the backend cannot fetch the file—usually due to missing or invalid `GITHUB_TOKEN` for private repos.

## 3. Check backend logs

When the backend starts and processes locations, it logs catalog activity. Look for:

- Errors containing `UrlReader`, `github`, or `403`/`404`.
- Messages from `@backstage/plugin-catalog-backend-module-logs` about processing or errors.

Run from repo root so the backend runs with your env:

```bash
cd backstage-poc
export GITHUB_TOKEN=ghp_...
yarn start
```

Watch the terminal where the backend is running for errors after “Listening on :7007”.

## 4. Verify the URL manually

Check that the catalog file is reachable with your token:

```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://raw.githubusercontent.com/CreativeCapsule-IT/cc-backstage-terraform-catalogs/main/catalog/catalog-info.yaml
```

If this returns 404 or the repo is private and you get 404 without a token, fix repo visibility or token scope; then restart Backstage.

## 5. Docker: pass GITHUB_TOKEN into the container

When using `yarn docker:up` or `docker compose up`, the backstage service does **not** have your shell env. Pass the token explicitly:

```bash
# Option A: .env file next to docker-compose.yml (do not commit)
echo 'GITHUB_TOKEN=ghp_your_token' > .env
yarn docker:up

# Option B: inline
GITHUB_TOKEN=ghp_your_token yarn docker:up
# or
docker compose run -e GITHUB_TOKEN=ghp_xxx backstage  # then open the URL shown
```

Rebuild the image after config or script changes: `yarn docker:build`.

## Reference

- [Backstage Software Catalog](https://backstage.io/docs/features/software-catalog/)
- [GitHub Locations](https://backstage.io/docs/integrations/github/locations/)
