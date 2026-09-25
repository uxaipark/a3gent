# a3gent.com

Static site. Caddy serves **`site/` directly** — there is no build step for
the site itself. Editing a file under `site/` changes the live site immediately
(a3gent.com and, for the interim path, mohazi.com/a3gent/). Anything outside
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
- `about/`, `en/about/` — About page: what a3gent does and does not do, five
  building standards, and the direction it builds toward. Deliberately **no
  résumé content** (career list, stats, schooling, employers) — keep it about
  philosophy. Where the landing's capabilities cite past work, only Samsung
  Electronics is named; other employers and all clients stay generic, and
  the current employer is never mentioned.
- `demos/oralpilot/`, `demos/soma/` — **static builds** of the demo apps.
  Never edit by hand: change `src/<demo>` and run `publish.sh`. They are
  built with absolute base paths `/demos/oralpilot/`, `/demos/soma/`.
- `media/` — solution card slides (`soma-1..5.jpg`, `oralpilot-1..5.jpg`).

## SEO
- Every page head has canonical, hreflang (ko/en/x-default), Open Graph and
  Twitter tags with **absolute `https://a3gent.com/…` URLs** — canonical is
  what keeps the mohazi.com/a3gent/ copy from counting as a duplicate. Body
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
