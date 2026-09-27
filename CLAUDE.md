# a3gent.com

Static site. Caddy serves **`site/` directly** — there is no build step for
the site itself. Editing a file under `site/` changes the live site immediately
(a3gent.com; the old interim path mohazi.com/a3gent/… and mohazi.com/demos/…
301 to the same path on a3gent.com). Anything outside
`site/` is not served. Caddy's config lives in the ELIS
repo (`/home/master/dev/elis/Caddyfile`, a3gent.com block); deploying it
needs sudo: the user runs `bash scripts/deploy-caddy.sh` there.

## Layout
- `site/` — the web root. Paths below are relative to it.
- `src/oralpilot/`, `src/soma/` — demo app sources, each its own git repo
  (branch `self-host`, GitHub remotes), gitignored here.
- `publish.sh` — `bash publish.sh oralpilot|soma` builds `src/<demo>` and
  replaces `site/demos/<demo>/` only if the build succeeds.

Inside `site/`:
- `index.html`, `en/index.html` — landing (KO / EN). Same section structure;
  keep copy changes in both.
- `style.css`, `ui.js` (reveal, counters, slideshows, inquiry modal),
  `spot.js` (hero spotlight + card shadows), `laser.js` (inquiry-modal
  transition; optional — remove its `<script>` tag to drop the effect).
- `viewer/<demo>/`, `en/viewer/<demo>/` — viewer pages: site header + an
  `<iframe>` of the demo. Relative links; depth matters.
- `demos/index.html`, `demos/en/` — demo hub mirroring the landing's cards.
- Solutions (landing `#solutions`, four cards, same order in the demo hub and
  in the hero's domain cards). Every solution has a **screen-demo** page,
  `solutions/<slug>/` and `en/solutions/<slug>/`: hero, key-screen tour,
  figures, specs, limits. SOMA and OralPilot also have **live demos**
  (`viewer/<demo>/`), so their card shows both links and their page leads
  with "라이브 데모 열기"; Bio-Signal IoT Platform and Bio-Signal Emulator
  have only the screen demo. The tour is `[data-tour]` in ui.js (one step at
  a time in a fixed 16:10 frame, prev/next, thumbnail strip, arrow keys,
  `#screen-NN` deep links; without JS the steps are simply listed).
  Images: `media/<slug>/NN.jpg` + `tNN.jpg` thumbnails (320×200); SOMA and
  OralPilot have per-language screenshots under `media/<slug>/<lang>/`,
  captured from the live demos at 1600×1000. Card slides:
  `media/<slug>-1..5.jpg` (1200×750). Copy comes from each solution's own
  material (README, on-screen labels) — don't add claims beyond it.
- Field landing pages (one search intent each, KO `/<slug>/`, EN `/en/<slug>/`):
  `medical-ai` (hub), `biosignal-ai`, `medical-imaging-ai`,
  `hospital-monitoring`, `ai-agent`. Each: keyword H1 and title
  ("<topic> 개발 — <related terms> | a3gent"), problems it fits, technology
  table, four steps, related solutions/fields, FAQ with FAQPage JSON-LD (in
  the body, `id="faq-ld"`), inquiry CTA. Don't let two pages target the same
  query. Every page's footer carries a `footer-fields` nav linking all five
  (internal links matter for ranking) — add new pages there too.
  The header nav has 분야/Fields (`a.nav-fields`, after 솔루션) pointing to the
  `medical-ai` hub, marked current on field pages; on tablets (761–1000 px)
  only Solutions, Fields, the CTA and the language switch show.
- Copy style: outcome-first, short headlines, often a contrast pair
  ("시제품은 적게, 검증은 먼저"); one or two sentences that say how and what
  results, with concrete numbers where the material has them; Korean H1/H2 in
  noun form (개조식), body in plain 합니다 체; avoid dated words (귀사 → 고객사).
- `media/` is served with a one-day browser cache: when you replace an image
  under the same name, add or bump a `?v=N` on every URL that points to it
  (cards in the landing and demo hub, solution pages).
- `about/`, `en/about/` — About page: what a3gent does and does not do, a
  short "만드는 사람" summary (three credibility points, no timeline, dates,
  schooling or employer list — it must not read like a résumé), five building
  standards, and the direction it builds toward. The lead stays anonymous. Where the landing's capabilities cite past work, only Samsung
  Electronics is named; other employers and all clients stay generic, and
  the current employer is never mentioned.
- `demos/oralpilot/`, `demos/soma/` — **static builds** of the demo apps.
  Never edit by hand: change `src/<demo>` and run `publish.sh`. They are
  built with absolute base paths `/demos/oralpilot/`, `/demos/soma/`.
- `media/` — solution card slides (`soma-1..5.jpg`, `oralpilot-1..5.jpg`).

## SEO
- Every page head has canonical, hreflang (ko/en/x-default), Open Graph and
  Twitter tags with **absolute `https://a3gent.com/…` URLs** — canonical is
  what keeps any other copy (e.g. the LAN address) from counting as a duplicate. Body
  links stay relative. The home pages also carry Organization/WebSite JSON-LD.
- A new page needs the same head block and an entry (with its ko/en pair) in
  `sitemap.xml`; bump `<lastmod>` when content changes.
- Share images: `media/og-ko.jpg`, `media/og-en.jpg` (1200×630);
  `media/logo-512.png` is the JSON-LD logo.
- `google*.html`, `naver*.html` at the root are Search Console / 네이버
  서치어드바이저 ownership files — do not delete.
- Caddy (a3gent.com block) compresses responses, sends `X-Robots-Tag: noindex`
  for the demo apps under `/demos/<demo>/` (search should land on
  `/viewer/<demo>/`), and caches `media/` and the hashed `_next/static/` assets.

## Contact form
The dialog markup lives only in `partials/inquiry-ko.html` / `inquiry-en.html`.
Any page with a `[data-inquiry]` button gets it: ui.js fetches the partial for
the page's `lang` (resolved against the page's `style.css` link), queues an
early click, and falls back to the landing's `#contact` if the fetch fails.
Include `laser.js` on the page for the opening transition.

The modal posts to `/api/inquiry`, which Caddy proxies to everynote
(ELIS, `apps/everynote/src/app/api/inquiry/route.ts`): spam/injection
screening, 200-char minimum, storage as an Inquiry row + a note in the
비즈니스 문의 section, and an email copy (SMTP in everynote's `.env`).
Nothing about the form's backend lives in this repo.

## Conventions
- Plain HTML/CSS/ES5-style JS, no libraries, no bundler. CSP is
  `default-src 'self'`: no inline scripts, no external assets.
- `prefers-reduced-motion` disables every animation.
- Verify visually with headless Chromium via CDP (see the session notes in
  ELIS); `chrome --headless=new --screenshot` does not advance rAF.
