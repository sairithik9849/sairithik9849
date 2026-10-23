GitHub profile README: `README.md` renders on github.com/sairithik9849, and `main` is live, so a push publishes.

## Shape

`README.md` holds four parts: the header, the "daily drivers" stack strip, one intro paragraph, two `<samp>` contact lines. Four parts is deliberate; new sections are Sai's call.

GitHub strips README HTML outside its allowlist (`style` attributes, `<style>`, scripts) without warning. After any HTML change, read GitHub's own render: `gh api markdown -f mode=gfm -f context=sairithik9849/sairithik9849 -F text=@README.md`.

Each `<picture>` uses the first `<source>` that matches, so the desktop pair (`min-width: 1012px`, GitHub's `lg` breakpoint) stays above the phone pair.

## SVGs

The eight `assets/*.svg` (header and stack, desktop and phone, light and dark) are build output of `scripts/build-assets.mjs`: edit the script, run `npm run build`, commit script and SVGs together. The build is byte-reproducible, so an unchanged script yields no diff.

- GitHub serves SVGs as images, which load no fonts or external files, so text ships as outlined paths and everything stays inline. CSS animation and SMIL both play; hover and JS never run.
- Each image is described twice: its title and desc in the script (`TITLE`/`DESC` for the header, `STRIP` for the stack) and its `<img alt>` in `README.md`. A content change updates both.
- Stack logos are one color: ink at rest, accent only while animating, from the pinned `simple-icons`.
- The header was ported from the prototype at https://claude.ai/artifact/KFzqbeS64tacyfLTKTsc9S; the script is now the source of truth.

An SVG change is done when its four files have been rendered in a browser and looked at, plus one under `prefers-reduced-motion: reduce`: the header shows frozen SAIRITHIK, full diagram, finished tagline, no packets or readout; the stack shows the full ink row, still. Playwright's reduced-motion emulation never reaches an SVG inside `<img>`, so open the SVG itself for that check. Phone reuses the desktop diagram, so a desktop header edit can break phone.

## Copy

README prose is in Sai's voice: write it with the `sai-voice` skill. Figures (40+ users, halved time per ticket) come from Sai; ask for any new one.
