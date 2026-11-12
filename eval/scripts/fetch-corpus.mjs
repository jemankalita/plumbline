// Builds the real-post evaluation corpus from GOV.UK news under the Open Government Licence v3.0.
// Prints counts only, so the session that later tunes the engine never sees the sealed holdout.
// Usage: node eval/scripts/fetch-corpus.mjs

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "corpus");
const API = "https://www.gov.uk/api";
const HEADERS = { "User-Agent": "plumbline-eval/1.0", Accept: "application/json" };

const TARGET = 80;
const DEV_COUNT = 20;
const MAX_PER_ORG = 4;
const MIN_CHARS = 350;
const MAX_CHARS = 1000;
const MIN_PARAGRAPHS = 2;
const POLL_DELAY_MS = 150;
const SPLIT_SALT = "plumbline-split-v1";
const DOC_TYPES = ["press_release", "news_story"];
const OLDEST = "2025-01-01";

// OGL v3 does not cover personal data, so paragraphs naming or quoting people are removed.
const PERSONAL = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\b(?:\+?\d[\d ()-]{8,}\d)\b/,
  /[“”"]/,
  /\b(?:said|says|added|commented)\b/i,
  /\b(?:Mr|Mrs|Ms|Dr|Sir|Dame|Lord|Lady|Baroness|Baron|Professor|Prof|Minister|Secretary|MP|MSP|Chancellor|Commissioner|Chief Executive|CEO|Chair|Director|King|Queen|Prince|Princess)\b/,
];

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", pound: "£", hellip: "…" };

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Paragraphs and list items only, with no markup. Empty when the body has nothing usable. */
export function paragraphs(html) {
  return [...String(html).matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

/** A short post from the opening paragraphs that carry no personal data. */
export function toPost(html) {
  const kept = paragraphs(html).filter((p) => !PERSONAL.some((re) => re.test(p)));
  const chosen = [];
  let size = 0;
  for (const p of kept) {
    if (size + p.length > MAX_CHARS) break;
    chosen.push(p);
    size += p.length;
    if (size >= MIN_CHARS && chosen.length >= MIN_PARAGRAPHS) break;
  }
  return size >= MIN_CHARS && chosen.length >= MIN_PARAGRAPHS ? chosen.join("\n\n") : null;
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function candidates() {
  const fields = "link,title,public_timestamp,organisations";
  const lists = await Promise.all(
    DOC_TYPES.map((type) => getJson(`${API}/search.json?filter_content_store_document_type=${type}&count=800&order=-public_timestamp&fields=${fields}`))
  );
  return lists
    .flatMap((list) => list.results)
    .filter((r) => r.public_timestamp >= OLDEST)
    .sort((a, b) => sha256(`${SPLIT_SALT}|sample|${a.link}`).localeCompare(sha256(`${SPLIT_SALT}|sample|${b.link}`)));
}

async function collect(pool) {
  const posts = [];
  const perOrg = new Map();
  const skipped = { orgCap: 0, unusable: 0, failed: 0 };
  for (const item of pool) {
    if (posts.length === TARGET) break;
    const org = item.organisations?.[0]?.acronym ?? item.organisations?.[0]?.title ?? "unknown";
    if ((perOrg.get(org) ?? 0) >= MAX_PER_ORG) {
      skipped.orgCap += 1;
      continue;
    }
    await sleep(POLL_DELAY_MS);
    try {
      const doc = await getJson(`${API}/content${item.link}`);
      const withdrawn = doc.withdrawn_notice && Object.keys(doc.withdrawn_notice).length > 0;
      const text = doc.locale === "en" && !withdrawn ? toPost(doc.details?.body ?? "") : null;
      if (!text) {
        skipped.unusable += 1;
        continue;
      }
      perOrg.set(org, (perOrg.get(org) ?? 0) + 1);
      posts.push({ title: doc.title, text, sourceUrl: `https://www.gov.uk${item.link}`, docType: doc.document_type, org, publishedAt: item.public_timestamp });
    } catch (error) {
      skipped.failed += 1;
      console.error(`Could not fetch one page: ${error.message}`);
    }
  }
  return { posts, skipped, orgs: perOrg.size };
}

function withSplit(posts) {
  return posts
    .slice()
    .sort((a, b) => sha256(`${SPLIT_SALT}|${a.sourceUrl}`).localeCompare(sha256(`${SPLIT_SALT}|${b.sourceUrl}`)))
    .map((p, i) => ({ id: `gv-${String(i + 1).padStart(3, "0")}`, split: i < DEV_COUNT ? "dev" : "holdout", ...p }));
}

function licenceLog(posts) {
  const header = "id,split,source_url,licence,changes";
  const change = "Opening paragraphs extracted as plain text; paragraphs naming or quoting people and contact details removed";
  const rows = posts.map((p) => [p.id, p.split, p.sourceUrl, "Open Government Licence v3.0", `"${change}"`].join(","));
  return [header, ...rows].join("\n") + "\n";
}

async function main() {
  const pool = await candidates();
  const { posts, skipped, orgs } = await collect(pool);
  if (posts.length < TARGET) throw new Error(`Only ${posts.length} of ${TARGET} usable posts found; widen the pool before labelling.`);
  const split = withSplit(posts);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "posts.jsonl"), split.map((p) => JSON.stringify(p)).join("\n") + "\n");
  writeFileSync(join(OUT_DIR, "licence-log.csv"), licenceLog(split));
  const sizes = split.map((p) => p.text.length).sort((a, b) => a - b);
  console.log(JSON.stringify({ posts: split.length, dev: split.filter((p) => p.split === "dev").length, holdout: split.filter((p) => p.split === "holdout").length, organisations: orgs, medianChars: sizes[Math.floor(sizes.length / 2)], poolSize: pool.length, skipped }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
