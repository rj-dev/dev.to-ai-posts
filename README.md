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

1. **Create a repo** and push this folder to it.
2. **Get a dev.to API key**: dev.to → Settings → Extensions → DEV API Keys.
3. **Get an Anthropic API key**: console.anthropic.com → API Keys.
4. **Add both as GitHub repo secrets**: Repo → Settings → Secrets and
   variables → Actions → New repository secret
   - `DEVTO_API_KEY`
   - `ANTHROPIC_API_KEY`
5. **Push to GitHub.** The workflow runs automatically every Monday and
   Thursday at 09:00 UTC.

## Testing it

**1. Dry run via GitHub Actions (safest, no setup needed)**
Repo → Actions tab → "Publish dev.to post" → Run workflow. The `dry_run`
checkbox defaults to **checked**, so this generates an article (and refills
the queue if it's empty) but does not publish anything or mark the topic as
done. Open the run's logs to read the full generated title, tags, and body.

**2. Real live test via GitHub Actions**
Same as above, but untick `dry_run` before running. This calls the real
dev.to API and **publishes live immediately** — there's no review step yet,
so whatever gets generated goes out under your account.

**3. Local test (fastest feedback loop)**

```bash
git clone <your-repo-url>
cd devto-automation
DRY_RUN=true ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-and-publish.js
```

Drop `DRY_RUN=true` and add `DEVTO_API_KEY=...` once you're ready to actually
publish. Node 20+ is required (uses the built-in `fetch`).

Scheduled runs (the Monday/Thursday cron) always publish for real — the
dry-run default only applies to manual runs from the Actions tab.

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

Open `scripts/generate-and-publish.js`, find `publishToDevTo()`, and change
`published: true` to `false` — posts will land as drafts in your dev.to
dashboard instead of going live automatically, and you approve/publish them
yourself from there.

## Worth knowing

- Topics from the roadmap queue rely on the short `context` field, not your
  actual code, so Claude can get project specifics wrong.
- Trend-based topics are generated with an explicit instruction not to copy
  or paraphrase any specific trending article — worth spot-checking the
  first few refills (dry-run them) to confirm that's holding.
