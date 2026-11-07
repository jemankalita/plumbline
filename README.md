# Plumbline

**Brand governance that works before you hit publish.** Plumbline checks captions, emails, web copy and banners against an organisation's brand guidelines and its register of approved facts. Every finding cites the exact rule or fact it breaks and suggests a fix that keeps the writer's message. A person makes every decision.

Team **Diet Code** (Jeman Kalita, Krishnesha Sarma). Problem statement by Inkloom AI. Round 2: functional product.

- **Live app:** _add the Vercel URL here_
- **Demo brand:** "QuickKart", a fictional quick-commerce company. It is not a real business.

---

## The central workflow (working end to end)

1. **Brand Kit** (Admin). Rules, terminology, approved facts with owners and expiry dates, voice and palette. You can import them from a guideline PDF, DOCX or Markdown file. AI proposes items and the admin picks which to keep.
2. **Submit** (Creator). Paste text or upload a DOCX, PDF or MD file, and optionally add an image. Then mark whether AI helped draft it, and lock the key message.
3. **Automatic review.** It runs four passes:

   | Pass | What it checks | How |
   |---|---|---|
   | Rules | terminology, banned phrases, sentence length, ALL-CAPS, legal terms, alt text, WCAG contrast, palette | deterministic |
   | Claims | every number and superlative vs. the approved-facts register → supported / unsupported / outdated / contradicted | deterministic |
   | Judgement | tone and messaging against the brand's own voice rules (personal data masked first) | Gemini, optional |
   | Verifier | drops any AI finding whose quoted span or cited rule doesn't exist | plain code |

4. **Fix, dispute or dismiss** (Creator). Accepting a fix shows it as a tracked change. Saving then creates v2, which is re-checked from scratch with a word-level diff against v1. A fix that would remove the locked key message is never offered as one click.
5. **Verify claims** (Reviewer). Unsupported claims and low-confidence AI findings are routed to a reviewer to clear.
6. **Approve** (Approver). Approval is blocked while blockers or routed items are open. An approver can override a blocker only with a written reason of 10 or more characters.
7. **Log and learn.** Every action goes to an append-only audit log. Insights shows recurring issues and compares AI-assisted drafts with human ones. The **Guideline Gap Finder** flags rules that keep getting overridden as probably unclear.

The demo uses a role switcher in the top bar (Creator, Reviewer, Approver, Admin). Permissions follow the role matrix in the Round 1 plan. They are enforced on the server for every API call, not just hidden in the UI.

## Architecture

```
Next.js 16 (App Router, React 19, TypeScript, Tailwind v4, Motion)
 ├─ src/lib/engine/      Review Engine: rules.ts · claims.ts · verify.ts · index.ts (orchestrator)
 ├─ src/lib/ai/gemini.ts LLM provider behind an interface (swappable; JSON-only replies, timeouts, model fallback)
 ├─ src/lib/db/          store.ts (Supabase or local JSON file) · repo.ts (domain logic) · seed.ts (demo brand)
 ├─ src/lib/auth*.ts     role matrix + server-side checks
 ├─ src/app/api/*        route handlers, zod-validated, one { ok, data | error } envelope
 └─ supabase/schema.sql  tables, FKs, "finding must cite exactly one Brand Kit record" constraint, RLS on
```

How trust is built into the design:
- **Explainability is a database constraint.** A finding row needs exactly one real `ruleId`, `termId` or `factId` foreign key.
- **The model never writes to the database.** Its JSON is schema-checked and verified against the draft first.
- **The draft is fenced as untrusted data** in the prompt, and instructions inside it are ignored.
- **Emails, phone numbers and ID numbers are masked** before any AI call, and offsets are mapped back afterwards.
- **Images get a small copy, not the original.** Dominant colours are computed on a canvas in the browser. A resized copy goes to Gemini, which judges it against the kit's image rules and reads any words on it. Code then checks those words for wrong names and unproven claims.
- **An AI opinion about a picture never blocks on its own.** Each verdict must cite a real image rule and give a reason. If the AI returns no usable verdicts, the check is shown as failed, never as a pass.
- **Code has the last word on readable words.** AI names the colours of words on an image, and code measures their contrast.
- **Repeat checks stay steady.** Calls run at temperature 0 with a fixed seed, and the same image against the same rules reuses its saved result for an hour.
- **Public checks are limited.** `/api/review` allows 12 checks per client every 10 minutes and 300 a day in total. Saving versions allows 30 per client every 10 minutes. Counts are per server process, so they are approximate on a multi-instance host.
- **Every check discloses its AI use:** the provider, which passes used it, and how many AI findings the verifier dropped.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY and Supabase keys
npm run dev                  # http://localhost:3000
```

With no environment variables, the app uses a local JSON database (`.data/plumbline.json`, seeded on first run) and switches the AI pass off. Everything else works.

### Supabase

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-only).

The demo brand seeds itself on first request.

**Hosting note:** without Supabase, data lives in a local JSON file. That works on a single server. On Vercel the file sits in `/tmp`, which isn't shared between instances, so a hosted deployment should set the Supabase variables above.

### Tests

```bash
npm test          # engine unit tests: passes, decision tree, verifier, redaction, intent lock
npm run typecheck
```

CI (GitHub Actions) runs typecheck, tests and a production build on every push.

## Round 1 plan → Round 2 status

| Planned | Status |
|---|---|
| Brand Kit builder (rules, terms, facts with expiry, palette) + guideline import | ✅ built |
| Text review: tone, terms, messaging, claims, readability, with inline highlights and citations | ✅ built |
| Claim checker (supported / unsupported / outdated / contradicted) | ✅ built |
| Intent-preserving fixes with an intent-lock check | ✅ built (token-level check; semantic check planned) |
| Workflow: roles, per-finding decisions, routing, approvals, overrides, versions, audit log | ✅ built |
| Image checks: AI judges photos against the Brand Kit, reads words on the image; palette, contrast and alt text by code | ✅ built |
| AI-use disclosure on every review | ✅ built |
| Insights + Guideline Gap Finder | ⏳ early version built; fuller version in Round 3 |
| Video, Instagram Reels and YouTube Shorts checks | Round 3 |
| Logo / layout checks on full designs, learning from reviewer decisions, real auth (Supabase Auth) | Round 3 |

## Demo image credits

All three photographs are CC0. The brand text on the banners was added for this demo, and QuickKart is a fictional brand.

- "Free closeup fresh vegetables table" via [rawpixel](https://www.rawpixel.com/image/5927583/photo-image-public-domain-plant-fruit)
- "A platter brimming with oil lamps, during the Diwali evening." by Hemant Kumar Chhapoliya, via WordPress Photo Directory
- "(flou) The Collection Cars (1)" by Mathious Ier, via Wikimedia Commons

## Disclosure

AI coding assistance was used during development. In the product, Google Gemini is used only for the judgement pass, alt-text drafts and guideline import, and each use is shown in the UI.
