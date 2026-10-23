GitHub profile README: `README.md` renders on github.com/sairithik9849, and `main` is live, so a push publishes.

## Shape

`README.md` holds three parts: the header, one intro paragraph, two `<samp>` contact lines. Three parts is deliberate; new sections are Sai's call.

GitHub strips README HTML outside its allowlist (`style` attributes, `<style>`, scripts) without warning. After any HTML change, read GitHub's own render: `gh api markdown -f mode=gfm -f context=sairithik9849/sairithik9849 -F text=@README.md`.

The header `<picture>` uses the first `<source>` that matches, so the desktop pair (`min-width: 1012px`, GitHub's `lg` breakpoint) stays above the phone pair.

## Header

The four `assets/*.svg` are build output of `scripts/build-header.mjs`: edit the script, run `npm run build:header`, commit script and SVGs together. The build is byte-reproducible, so an unchanged script yields no diff.

- GitHub serves SVGs as images, which load no fonts or external files, so text ships as outlined paths and everything stays inline. CSS animation and SMIL both play.
- The header is described twice: `TITLE`/`DESC` in the script and the `<img alt>` in `README.md`. A content change updates both.
- The script was ported from the prototype at https://claude.ai/artifact/KFzqbeS64tacyfLTKTsc9S; the script is now the source of truth.

A header change is done when all four SVGs have been rendered in a browser and looked at, plus one under `prefers-reduced-motion: reduce` (frozen SAIRITHIK, full diagram, finished tagline, no packets or readout). Phone reuses the desktop diagram, so a desktop edit can break phone.

## Copy

README prose is in Sai's voice: write it with the `sai-voice` skill. Figures (40+ users, halved time per ticket) come from Sai; ask for any new one.
