# Plumbline

**Live product:** https://plumbline-opal.vercel.app

**Brand governance that works before you hit publish.** Plumbline checks captions, emails, web copy, images and short videos against an organisation's brand guidelines and its register of approved facts. Every finding cites the exact rule or fact it breaks and suggests a fix that keeps the writer's message. A person makes every decision. AI never publishes and never approves.

Team **Diet Code** (Jeman Kalita, Krishnesha Sarma). Problem statement by Inkloom AI. Round 3: the finished product.

- **Demo brands:** "QuickKart" (quick-commerce groceries) and "Harbour & Pine" (homewares). Both are fictional.
- **Live app:** https://plumbline-opal.vercel.app
- **Demo brand:** "QuickKart", a fictional quick-commerce company. It is not a real business.

---

## Try it in three minutes

No account is needed. Open the workspace (**Open the workspace** on the landing page, or `/queue`) and follow the **Try it as a judge** box.

1. Open the Diwali draft and see what was flagged, and why. Each card names its rule and whether code or AI found it.
2. Accept a fix, or mark a finding "Not an issue" and pick a reason.
3. Switch role in the top bar to **Approver** and try to approve. Open blockers stop you, and the button says why.
4. Open **New draft**, pick a sample text or demo image, and run the brand check. For video, download the sample Reel from the landing page, choose the Reels channel and add it.
5. Open **How accurate** for the measured accuracy and its limits.

**Roles.** Switch between Creator, Reviewer, Approver and Admin from the top bar, and between the two organisations. No password or code is needed for any role. The server checks the role on every action, not just the UI.

**The Admin code has been removed for judging.** Admin, the role that edits the Brand Kit, used to need a code. We removed it so judges can try every role, including the Brand Kit, without asking us for anything. Kit changes are still logged in the audit trail. A per-person sign-in comes back with the pilot (see Roadmap).

## The central workflow

1. **Brand Kit** (Admin). Rules, terminology, approved facts with owners and expiry dates, palette and a reference logo. You can import them from a guideline PDF, DOCX or Markdown file. AI proposes items and the Admin picks which to keep.
2. **Submit** (Creator). Paste text or upload a DOCX, PDF or MD file. Optionally add an image or a short video for Reels or Shorts. Mark whether AI helped draft it, and lock the key message.
3. **Automatic review.** Code checks first, AI second, and code verifies the AI:

   | Pass | What it checks | How |
   |---|---|---|
   | Rules | terminology, banned phrases, sentence length, ALL-CAPS, legal terms, alt text, WCAG contrast, palette | code |
   | Claims | every number and superlative vs. the approved-facts register → supported / unsupported / outdated / contradicted, compared by unit and currency | code |
   | Judgement | tone and messaging against the brand's own voice rules (personal data masked first) | Gemini, optional |
   | Image | five look-and-feel rules, words on the image; logo stretch, recolour and clear space; off-palette colour | AI finds and reads, code measures |
   | Video | on-screen words with timestamps, claims, logos in frames, time a disclaimer stays on screen, 9:16 shape and length | browser takes frames, AI reads, code checks |
   | Verifier | drops any AI finding whose quoted span or cited rule doesn't exist | code |

4. **Fix, dispute or dismiss** (Creator). Accepting a fix shows it as a tracked change. Saving creates v2, which is re-checked from scratch and shown as a word-level diff against v1. A finding you already decided stays decided if it has not changed. A fix that would remove the locked key message is never offered as one click.
5. **Verify claims** (Reviewer). Unsupported claims and low-confidence AI findings are routed to a reviewer to clear.
6. **Approve** (Approver). Approval is blocked while blockers or routed items are open. An approver can override a blocker only with a written reason of 10 or more characters.
7. **Log and learn.** Every action goes to an audit log, and every decision to a ledger, that the database refuses to edit or delete. A check the team keeps rejecting gets quieter for that organisation only, within safety limits. Insights shows recurring issues, and the Guideline Gap Finder flags rules that keep being overridden as probably unclear.

## Features

| Area | Feature | Status |
|---|---|---|
| Brand Kit | Rules, terms, approved facts with owners and expiry, palette, reference logo | Built |
| | Guideline import from PDF, DOCX or Markdown, AI proposes and the Admin chooses | Built |
| | Separate organisations, each with its own kit, drafts, decisions and audit log | Built |
| Checking | Text review with highlights and citations | Built |
| | Claim checker, numbers compared by unit and currency | Built |
| | Verifier for every AI finding | Built |
| | Image checks: AI-judged rules, words on the image, contrast, palette, alt text with a drafted fix | Built |
| | Logo checks: stretch, recolour and clear space, measured by code | Built |
| | Video checks for Reels and Shorts, every problem with its timestamp | Built |
| Workflow | Intent-preserving fixes, tracked changes, versions with a word-level diff | Built |
| | Decisions that carry forward to the next version | Built |
| | Roles and routing, enforced on the server | Built |
| | Approval gate, overrides with a logged reason | Built |
| | Append-only audit log and decision ledger | Built |
| Learning and trust | Per-organisation learning from reviewer decisions | Built |
| | Insights | Built |
| | Guideline Gap Finder | Early version |
| | How accurate page: measured results and their limits, inside the product | Built |
| | AI-use disclosure on every check, personal data masked before any AI call | Built |
| | Works with no AI key: rules, claims, contrast and palette still run, and the page says AI did not | Built |
| | First-run guide, working layout at 390 px wide | Built |
| Access | Demo sign-in: signed cookie for organisation and role. Every role is open, with no Admin code, for judging. Not per-person accounts | Partial |

## The three improvements named at Round 2

1. **Prove the accuracy.** A labelled test set of 80 public posts (20 for development, 60 sealed), precision and recall per check, compared with three simpler systems, and published in the app at **How accurate**. Four real people tested the product, each on a different path.
2. **Richer visual governance.** Logo misuse (stretch, recolour, clear space), off-palette detection across the whole picture with CIEDE2000, a better alt-text flow, and video checks for Reels and Shorts.
3. **Learning from reviewers.** Accepted and dismissed findings feed an append-only ledger, per organisation. A rule the team keeps rejecting is quietened or demoted. Blockers, legal, claim and accessibility checks never change.

Deliberate changes, also stated in the PDF: video checks read words on screen but do not listen to speech, so the video file never leaves the device. Confidence is calibrated per rule rather than rewritten on each AI finding.

## Run it locally

You need **Node 24** and npm. No keys are needed.

```bash
git clone https://github.com/jemankalita/plumbline
cd plumbline
npm install
npm run dev                  # http://localhost:3000
```

With no environment variables, Plumbline uses a local JSON database (`.data/plumbline.json`, filled with both demo brands on first run) and switches the AI passes off. Everything else works, and the interface says what is off.

### Optional settings

Copy `.env.example` to `.env.local` and fill in what you need.

| Variable | Turns on |
|---|---|
| `GEMINI_API_KEY` | Tone, image and video reading, alt-text drafts, guideline import. A free key from Google AI Studio works |
| `GEMINI_MODEL` | Overrides the first Gemini model tried |
| `SUPABASE_URL` | The durable database |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access. Never expose it to the browser |
| `SESSION_SECRET` | Signs the demo sign-in cookie. Required on a hosted server |

### Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Type check |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Browser journey (Playwright) against a running server. Set `E2E_BASE_URL` to test another address. Run `npx playwright install chromium` once first |
| `npm run seed` | Fill a new Supabase database with the two demo brands. Safe to repeat |
| `npm run reset` | Clear the Supabase demo data and seed it again |
| `npm run eval` | Re-run the accuracy test, for example `npm run eval -- --split dev --version dev-1`. Needs a Gemini key |

### Deploying with a database

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in its SQL editor. It creates the tables, functions, triggers and row-level security.
3. Set the five variables above on the host (for example Vercel).
4. Run `npm run seed` with the same Supabase values in `.env.local`, then open the app.

Without the Supabase settings, a hosted server opens its pages but refuses to save, rather than losing work in a temporary file.

## Architecture

```
Next.js 16 (App Router, React 19, TypeScript, Tailwind v4, Motion)
 ├─ src/lib/engine/      Review Engine: rules · claims · verify · vision · video · logo · palette · calibrate · fingerprint
 │                       index.ts is the orchestrator
 ├─ src/lib/ai/gemini.ts LLM provider behind an interface (JSON-only replies, timeouts, model fallback, capped total wait)
 ├─ src/lib/db/          store.ts (Supabase or local JSON file) · repo.ts (domain logic) · seeds for both demo brands
 ├─ src/lib/eval/        the accuracy harness        eval/   corpus, labels and the manifest of hashes
 ├─ src/lib/auth*.ts     role matrix, signed session cookie, server-side checks
 ├─ src/app/api/*        route handlers, zod-validated, one { ok, data | error } envelope
 └─ supabase/schema.sql  12 tables, decide_finding(), append-only triggers, rate limits, RLS on every table
```

How trust is built into the design:
- **Explainability is a database constraint.** A finding row needs exactly one real `ruleId`, `termId` or `factId` foreign key.
- **The model never writes to the database.** Its JSON is schema-checked and verified against the draft first.
- **The draft is fenced as untrusted data** in the prompt, and instructions inside it are ignored.
- **Emails, phone numbers and ID numbers are masked** before any AI call, and offsets are mapped back afterwards.
- **Images get a small copy, not the original.** Video stays on the device: the browser takes still frames and only those are read.
- **An AI opinion about a picture never blocks on its own.** AI finds the logo and reads words, and code measures stretch, colour, clear space and contrast. If the AI returns no usable verdicts, the check is shown as failed, never as a pass.
- **Decisions cannot be lost or doubled.** `decide_finding` updates the finding and writes the ledger and audit rows in one transaction. A client request ID makes a repeated click return the first result.
- **Repeat checks give the same answer.** Every AI answer is stored by a hash of the exact request, so an identical check reuses it on any server. Changing a rule changes the request, so it is asked afresh.
- **Learning stays safe.** It needs decisions from several drafts and people, weights recent decisions more, caps any one person's share, and can be pinned off per rule for 30 days.
- **Sessions cannot be forged.** Organisation and role sit in an HMAC-signed, httpOnly cookie.
- **Public checks are limited.** `/api/review` allows 12 checks per client every 10 minutes and 300 a day in total, counted in Postgres so the limit holds across server instances.
- **Every check discloses its AI use:** the provider, which passes used it, and how many AI findings the verifier dropped.

To read the engine, start at `src/lib/engine/index.ts`, then `tests/engine.test.ts`.

## Testing

| Test | Result |
|---|---|
| Unit tests (`npm test`) | 125 of 125 pass |
| Type check and lint | Pass |
| Browser journey (`npm run test:e2e`) | Check, fix, save v2, send on, approval held by blockers: pass |
| Bad input, wrong roles, forged cookie, unsafe regex, missing pages, script tags in a draft | 18 of 18 refused or made harmless (run while the Admin code still existed) |
| Same decision sent 25 times at once | One ledger row |
| Rate limit across instances | 12 allowed, 2 refused, with a clear message |
| AI key broken | The draft is still checked, and the page says AI did not run |
| Backup and restore (`scripts/restore-test.ts`) | All 10 tables matched row by row |
| Media fixtures | Logo 30 of 30, clear space and palette 40 of 40 |
| Real users | 4 people on different paths. 10 problems they found are fixed |
| Unit-test coverage | 56% of `src/lib`, 34% of all `src`. Below our 80% target |

CI (GitHub Actions) runs the type check, unit tests and a production build on every push to `main` and every pull request.

## Accuracy

Tested once on 60 sealed posts after engine changes stopped, with one pinned model. Reference labels were made by AI labellers, not people, and the posts are UK government news. A finding counts only if it cites the right rule in the right place.

| System | Right when it flags | Issues found |
|---|---|---|
| Plumbline | 73% (66–80%) | 71% (64–78%) |
| Rules only | 85% (78–90%) | 66% (59–73%) |
| Without the verifier | 62% (55–68%) | 80% (73–85%) |
| Plain Gemini | 18% (12–25%) | 15% (10–21%) |

Compared with rules alone, AI found 8 more real issues and added 23 more false alarms. The full report is at `/trust` in the app, the numbers are in `public/eval/holdout-1.json`, and the hashes are in `eval/labels/manifest.json`.

## Known limits

- Demo sign-in uses roles, not per-person accounts, so learning's "people" are demo roles. With the Admin code removed, any visitor can edit the demo Brand Kit. Every change is in the audit log, and `npm run reset` restores the demo data.
- No retention or deletion controls and no local-model mode yet. Both are needed before real brand data goes in.
- Accuracy labels came from AI on government news, not from people on brand posts.
- Video checks do not listen to speech. Paste a script as text to check spoken lines.
- Checks run inside the request, not in a background queue. No Content-Security-Policy header yet.

## Roadmap

- **Now:** people label 100 real brand posts. A larger user test with task times. Add a CSP and raise test coverage.
- **Pilot, months 1 to 3:** two real teams. Per-person sign-in, retention and deletion, a paid Gemini key with a spending cap.
- **Next, months 4 to 6:** Google Docs and Word add-ins, a browser extension, ASCI and influencer rule packs, a per-seat price test.
- **Later:** opt-in speech checks, Hindi and Assamese, a local-model edition, PDF decks and live sites.

Each stage has a gate that decides the next one. The PDF lists the gates and how each is measured.

## Demo image credits

All three photographs are CC0. The brand text on the banners was added for this demo, and QuickKart and Harbour & Pine are fictional brands.

- "Free closeup fresh vegetables table" via [rawpixel](https://www.rawpixel.com/image/5927583/photo-image-public-domain-plant-fruit)
- "A platter brimming with oil lamps, during the Diwali evening." by Hemant Kumar Chhapoliya, via WordPress Photo Directory
- "(flou) The Collection Cars (1)" by Mathious Ier, via Wikimedia Commons

## AI tools

Claude Code was used as a coding assistant during development. Claude models also produced the reference labels for the accuracy test. Google Gemini runs inside the product for tone checks, image and video reading, alt text and guideline import.
