/**
 * Twice-weekly dev.to auto-publisher.
 *
 * Topic selection:
 *   1. If the queue in content-queue.json has any topic with status "pending",
 *      the oldest one is used.
 *   2. If the queue is empty, the script pulls dev.to's overall trending
 *      articles (last 7 days, all tags - not restricted to any niche) and
 *      asks Claude to generate a fresh batch of new topics inspired by what's
 *      resonating, appends them to the queue as "pending", then proceeds to
 *      publish the first one. The queue keeps refilling itself this way
 *      indefinitely - it never runs dry.
 *
 * Every published post is logged so future runs (including refills) know
 * what's already been covered and avoid repeating the same angle.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY - Anthropic API key (console.anthropic.com)
 *   DEVTO_API_KEY      - dev.to API key (dev.to -> Settings -> Extensions -> DEV API Keys)
 *                        not required when DRY_RUN=true
 *
 * Optional env var:
 *   DRY_RUN=true - generates the article (and refills the queue if needed)
 *                  but does NOT publish to dev.to and does NOT mark the
 *                  topic as done. Safe to run repeatedly for testing.
 *
 * IMPORTANT: content-queue.json is located relative to the current working
 * directory (process.cwd()), NOT relative to this script's own file path.
 * In GitHub Actions, the working directory for a `run:` step is the repo
 * root by default - so keep content-queue.json at the repo root, and this
 * script can live anywhere (root or a subfolder) without breaking.
 */

const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(process.cwd(), 'content-queue.json');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const MODEL = 'claude-sonnet-5';
const HISTORY_WINDOW = 10; // how many recent posts to show Claude, to avoid repeats
const REFILL_BATCH_SIZE = 6; // ~3 weeks of topics at 2/week

if (!ANTHROPIC_API_KEY || (!DRY_RUN && !DEVTO_API_KEY)) {
  console.error(
    `Missing ANTHROPIC_API_KEY${DRY_RUN ? '' : ' or DEVTO_API_KEY'} env var.`
  );
  process.exit(1);
}

if (!fs.existsSync(QUEUE_PATH)) {
  console.error(
    `Cannot find content-queue.json at ${QUEUE_PATH}. ` +
    `Make sure content-queue.json sits in the same directory the workflow ` +
    `runs from (the repo root by default).`
  );
  process.exit(1);
}

function loadQueue() {
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.queue = queue.queue || [];
  queue.published = queue.published || [];
  return queue;
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

function nextQueuedTopic(queue) {
  return queue.queue.find((t) => t.status === 'pending');
}

async function fetchTrendingCandidates() {
  // No tag filter - pulls dev.to's overall trending feed for the last 7 days.
  const res = await fetch('https://dev.to/api/articles?top=7&per_page=30');
  if (!res.ok) {
    throw new Error(`dev.to API error fetching trends: ${res.status} ${await res.text()}`);
  }
  const articles = await res.json();
  return articles
    .map((a) => ({
      title: a.title,
      tags: a.tag_list || [],
      reactions: a.public_reactions_count || 0,
    }))
    .sort((a, b) => b.reactions - a.reactions);
}

const STYLE_GUIDE = `
You write technical blog posts for dev.to about backend development with Node.js.
Voice and format rules:
- Clear, structured, accessible - written for working developers, not beginners to programming
- Use emoji section markers in headings (e.g. "## 🔧 The Problem")
- Include at least one engagement question for readers near the end
- Include realistic, runnable-looking code snippets in fenced code blocks
- Avoid generic filler; be specific about trade-offs and decisions
- Length: roughly 800-1400 words
- Where it fits naturally (not forced every time), you can draw on experience
  from a real side project called "minimalist-feedback-api" - a small,
  production-minded feedback/API service used as a learning vehicle
`.trim();

function buildArticlePrompt(topic) {
  return `${STYLE_GUIDE}

Write a dev.to post on this topic: "${topic.title}"
Context: ${topic.context}

Respond with ONLY raw JSON (no markdown fences, no preamble), matching this shape:
{
  "title": "string, punchy, under 70 characters",
  "tags": ["up to 4 lowercase alphanumeric tags, no spaces"],
  "body_markdown": "the full post body in markdown, NOT including the title as an H1"
}`;
}

function buildRefillPrompt(candidates, recentlyPublished) {
  const trendList = candidates
    .slice(0, 30)
    .map((c) => `- "${c.title}" [${c.tags.join(', ')}] (${c.reactions} reactions)`)
    .join('\n');
  const historyList = recentlyPublished.length
    ? recentlyPublished.map((p) => `- ${p.title}`).join('\n')
    : '(none yet)';

  return `${STYLE_GUIDE}

Here are titles currently trending across all of dev.to over the last 7 days,
ranked by engagement (not limited to any particular niche or tag):
${trendList}

Here are topics already published recently on this blog - avoid repeating these angles:
${historyList}

Generate ${REFILL_BATCH_SIZE} NEW blog post topic ideas for this blog, inspired
by what's currently resonating in the trending list. The blog's author is a
backend-focused Node.js / full-stack developer, so even when a trend is broad
or from a different niche, translate it into an angle this author would
credibly have an original take on. Do not copy or closely paraphrase any
specific trending article - use them only as a signal of what's currently
getting engagement.

Respond with ONLY raw JSON (no markdown fences, no preamble): an array of
exactly ${REFILL_BATCH_SIZE} objects:
[
  { "title": "working title", "context": "one to two sentence brief of the angle for this post" }
]`;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
#!/usr/bin/env node
/**
 * Twice-weekly dev.to auto-publisher.
 *
 * Topic selection:
 *   1. If the queue in content-queue.json has any topic with status "pending",
 *      the oldest one is used.
 *   2. If the queue is empty, the script pulls dev.to's overall trending
 *      articles (last 7 days, all tags) and asks Claude to generate a fresh
 *      batch of new topics inspired by what's resonating - staying in
 *      whatever domain the trend is actually in, not forced into Node.js.
 *      Those get appended to the queue as "pending", and the run continues
 *      by publishing the first one. The queue refills itself forever.
 *
 * Voice: pinned/roadmap topics (seeded from your project roadmap) are
 * written with the Node.js / minimalist-feedback-api framing, since that's
 * genuinely what they're about. Trend-sourced topics are written in
 * whatever language, framework, or domain the trend itself is in - the
 * "backend Node.js developer" framing is intentionally NOT applied to
 * those, so the blog doesn't force every trend into a Node.js story.
 *
 * Every published post is logged so future runs (including refills) know
 * what's already been covered and avoid repeating the same angle.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY - Anthropic API key (console.anthropic.com)
 *   DEVTO_API_KEY      - dev.to API key (dev.to -> Settings -> Extensions -> DEV API Keys)
 *                        not required when DRY_RUN=true
 *
 * Optional env var:
 *   DRY_RUN=true - generates the article (and refills the queue if needed)
 *                  but does NOT publish to dev.to and does NOT mark the
 *                  topic as done. Safe to run repeatedly for testing.
 *
 * content-queue.json is resolved relative to process.cwd(), which in
 * GitHub Actions `run:` steps is the repo root by default - keep
 * content-queue.json at the repo root regardless of where this script lives.
 */

const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(process.cwd(), 'content-queue.json');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const MODEL = 'claude-sonnet-5';
const HISTORY_WINDOW = 10; // how many recent posts to show Claude, to avoid repeats
const REFILL_BATCH_SIZE = 6; // ~3 weeks of topics at 2/week

if (!ANTHROPIC_API_KEY || (!DRY_RUN && !DEVTO_API_KEY)) {
  console.error(
    `Missing ANTHROPIC_API_KEY${DRY_RUN ? '' : ' or DEVTO_API_KEY'} env var.`
  );
  process.exit(1);
}

if (!fs.existsSync(QUEUE_PATH)) {
  console.error(
    `Cannot find content-queue.json at ${QUEUE_PATH}. ` +
    `Make sure content-queue.json sits in the same directory the workflow ` +
    `runs from (the repo root by default).`
  );
  process.exit(1);
}

function loadQueue() {
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  queue.queue = queue.queue || [];
  queue.published = queue.published || [];
  return queue;
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

function nextQueuedTopic(queue) {
  return queue.queue.find((t) => t.status === 'pending');
}

function isTrendTopic(topic) {
  return topic.id.startsWith('trend-');
}

async function fetchTrendingCandidates() {
  // No tag filter - pulls dev.to's overall trending feed for the last 7 days.
  const res = await fetch('https://dev.to/api/articles?top=7&per_page=30');
  if (!res.ok) {
    throw new Error(`dev.to API error fetching trends: ${res.status} ${await res.text()}`);
  }
  const articles = await res.json();
  return articles
    .map((a) => ({
      title: a.title,
      tags: a.tag_list || [],
      reactions: a.public_reactions_count || 0,
    }))
    .sort((a, b) => b.reactions - a.reactions);
}

// Format/voice rules only - no topic-domain framing here. Applies to every post.
const FORMAT_GUIDE = `
Format and voice rules for this dev.to blog:
- Clear, structured, accessible - written for working developers, not beginners to programming
- Use emoji section markers in headings (e.g. "## 🔧 The Problem")
- Include at least one engagement question for readers near the end
- Include realistic, runnable-looking code snippets in fenced code blocks,
  in whatever language actually fits the topic (not necessarily JavaScript)
- Avoid generic filler; be specific about trade-offs and decisions
- Length: roughly 800-1400 words
`.trim();

// Only used for pinned/roadmap topics, where this framing is genuinely true.
const PROJECT_CONTEXT = `
The author is a backend-focused Node.js / full-stack developer. Where it fits
naturally (not forced), you can draw on experience from a real side project
called "minimalist-feedback-api" - a small, production-minded Node.js
feedback/API service used as a learning vehicle.
`.trim();

// Used for trend-sourced topics - explicitly prevents forcing a Node.js angle.
const TREND_CONTEXT = `
This topic came from what's currently trending on dev.to as a whole. Write
about it in whatever language, framework, or area of software development the
trend is actually in - do not reframe it into a Node.js or backend angle
unless that's genuinely what the topic is about. It's completely fine for
this post to be about a different stack, language, or domain entirely.
`.trim();

function buildArticlePrompt(topic) {
  const context = isTrendTopic(topic) ? TREND_CONTEXT : PROJECT_CONTEXT;

  return `${FORMAT_GUIDE}

${context}

Write a dev.to post on this topic: "${topic.title}"
Context: ${topic.context}

Respond with ONLY raw JSON (no markdown fences, no preamble), matching this shape:
{
  "title": "string, punchy, under 70 characters",
  "tags": ["up to 4 lowercase alphanumeric tags, no spaces"],
  "body_markdown": "the full post body in markdown, NOT including the title as an H1"
}`;
}

function buildRefillPrompt(candidates, recentlyPublished) {
  const trendList = candidates
    .slice(0, 30)
    .map((c) => `- "${c.title}" [${c.tags.join(', ')}] (${c.reactions} reactions)`)
    .join('\n');
  const historyList = recentlyPublished.length
    ? recentlyPublished.map((p) => `- ${p.title}`).join('\n')
    : '(none yet)';

  return `${FORMAT_GUIDE}

Here are titles currently trending across all of dev.to over the last 7 days,
ranked by engagement (not limited to any particular niche or tag):
${trendList}

Here are topics already published recently on this blog - avoid repeating these angles:
${historyList}

Generate ${REFILL_BATCH_SIZE} NEW blog post topic ideas, inspired by what's
currently resonating in the trending list. Stay true to what's actually
trending - pick topics and technologies as they genuinely appear in the
list, WITHOUT reframing everything into Node.js or backend-specific angles.
If a trend is about Rust, Python tooling, a frontend framework, DevOps, AI,
databases, or anything else, the topic idea should stay in that lane rather
than being twisted toward Node.js. Diversity of subject matter across the
batch is good. Do not copy or closely paraphrase any specific trending
article - use them only as a signal of what's currently getting engagement.

Respond with ONLY raw JSON (no markdown fences, no preamble): an array of
exactly ${REFILL_BATCH_SIZE} objects:
[
  { "title": "working title", "context": "one to two sentence brief of the angle for this post" }
]`;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === 'text');
  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function refillQueueFromTrends(queue) {
  console.log('Queue is empty - discovering trending topics to refill it...');
  const candidates = await fetchTrendingCandidates();
  const recent = queue.published.slice(-HISTORY_WINDOW);
  const newTopics = await callClaude(buildRefillPrompt(candidates, recent));

  const stamp = Date.now();
  newTopics.forEach((t, i) => {
    queue.queue.push({
      id: `trend-${stamp}-${i}`,
      title: t.title,
      context: t.context,
      status: 'pending',
    });
  });

  saveQueue(queue);
  console.log(`Added ${newTopics.length} new trend-based topics to the queue.`);
}

async function publishToDevTo(article) {
  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': DEVTO_API_KEY,
    },
    body: JSON.stringify({
      article: {
        title: article.title,
        body_markdown: article.body_markdown,
        published: true, // flip to false later to add a manual review/draft step
        tags: article.tags,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`dev.to API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function main() {
  const queue = loadQueue();

  let topic = nextQueuedTopic(queue);

  if (!topic) {
    await refillQueueFromTrends(queue);
    topic = nextQueuedTopic(queue);
  }

  if (!topic) {
    console.log('No topic available even after refill attempt. Skipping this run.');
    return;
  }

  console.log(`Writing: ${topic.title}`);
  const article = await callClaude(buildArticlePrompt(topic));

  if (DRY_RUN) {
    console.log('\n=== DRY RUN: nothing published, queue not marked as done ===');
    console.log(`Title: ${article.title}`);
    console.log(`Tags: ${article.tags.join(', ')}`);
    console.log('\n--- Body ---\n');
    console.log(article.body_markdown);
    console.log('\n=== End of dry run ===');
    return;
  }

  console.log(`Publishing "${article.title}" to dev.to...`);
  const published = await publishToDevTo(article);

  topic.status = 'published';
  queue.published.push({
    title: article.title,
    url: published.url,
    publishedAt: new Date().toISOString(),
    source: isTrendTopic(topic) ? 'trend-discovery' : 'manual',
  });
  saveQueue(queue);

  console.log(`Published: ${published.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
