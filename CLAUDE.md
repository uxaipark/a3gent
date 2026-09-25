# a3gent.com

Static site, served **directly from this directory** by Caddy — there is no
build step. Editing a file changes the live site immediately (a3gent.com and,
for the interim path, mohazi.com/a3gent/). Caddy's config lives in the ELIS
repo (`/home/master/dev/elis/Caddyfile`, a3gent.com block); deploying it
needs sudo: the user runs `bash scripts/deploy-caddy.sh` there.

## Layout
- `index.html`, `en/index.html` — landing (KO / EN). Same section structure;
  keep copy changes in both.
- `style.css`, `ui.js` (reveal, counters, slideshows, inquiry modal),
  `spot.js` (hero spotlight + card shadows), `laser.js` (inquiry-modal
  transition; optional — remove its `<script>` tag to drop the effect).
- `viewer/<demo>/`, `en/viewer/<demo>/` — viewer pages: site header + an
  `<iframe>` of the demo. Relative links; depth matters.
- `demos/index.html`, `demos/en/` — demo hub mirroring the landing's cards.
- `demos/oralpilot/`, `demos/soma/` — **static builds** of the demo apps.
  Never edit by hand: sources are in `/home/master/dev/demos-src/{oralpilot,soma}`
  (branch `self-host`); rebuild with `npm run build:static` there and rsync
  `out/` here (`chmod -R a+rX`, drop `brand/`). They are built with absolute
  base paths `/demos/oralpilot/`, `/demos/soma/`.
- `media/` — solution card slides (`soma-1..5.jpg`, `oralpilot-1..5.jpg`).

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
