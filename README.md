# dev.to Auto-Publisher

Publishes a new article to dev.to twice a week (Mon + Thu, 9am UTC), fully
hands-off: GitHub Actions triggers the script on a cron schedule, the script
picks a topic, writes it via Claude, and publishes it live to dev.to. No
human step in between.

## How topic selection works

1. It pulls the oldest `"pending"` topic from the `"queue"` array in
   `content-queue.json` (seeded with your project roadmap: logging, rate
   limiting, JWT, Postgres, CI/CD).
2. Once the queue runs dry, the script automatically refills it: it pulls
   dev.to's overall trending articles from the last 7 days — **no tag
   restriction**, the whole site — and asks Claude to generate a fresh batch
   of new topics inspired by what's currently resonating, translated into
   angles a backend Node.js developer would credibly write about. Those get
   appended to the queue as `"pending"`, and the run continues by publishing
   the first one.
3. This repeats forever — the queue never actually runs out, it just
   regenerates itself from current trends whenever it's empty.

Every published post is logged under `"published"`, and recent ones are
shown back to Claude on refill so it doesn't regenerate the same angle twice.

## Setup

1. **Create a repo** and push this folder to it (or copy these files into
   an existing repo).
2. **Get a dev.to API key**
   dev.to → Settings → Extensions → DEV API Keys → generate a new key.
3. **Get an Anthropic API key**
   console.anthropic.com → API Keys → create a key.
4. **Add both as GitHub repo secrets**
   Repo → Settings → Secrets and variables → Actions → New repository secret
   - `DEVTO_API_KEY`
   - `ANTHROPIC_API_KEY`
5. **Push to GitHub.** The workflow in `.github/workflows/publish.yml` runs
   automatically every Monday and Thursday at 09:00 UTC. You can also
   trigger it manually from the Actions tab ("Run workflow").

## Adding your own topics anytime

Edit `content-queue.json` and add entries to `"queue"` in this shape —
they'll be used before the next auto-refill:

```json
{
  "id": "short-slug",
  "title": "Working title",
  "context": "A sentence or two on what the post should cover.",
  "status": "pending"
}
```

## Adding a review step later

Right now everything publishes live with zero approval. When you're ready
to add a review step, open `scripts/generate-and-publish.js`, find
`publishToDevTo()`, and change `published: true` to `false` — posts will
land as drafts in your dev.to dashboard instead of going live automatically,
and you approve/publish them yourself from there.

## Worth knowing

- Topics from the roadmap queue rely on the short `context` field, not your
  actual code, so Claude can get project specifics wrong.
- Trend-based topics are generated with an explicit instruction not to copy
  or paraphrase any specific trending article — worth spot-checking the
  first few refills to confirm that's holding.
