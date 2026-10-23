// Builds the README SVGs (header and stack strip; desktop and phone layouts, light and dark). The header was
// ported from the prototype at https://claude.ai/artifact/KFzqbeS64tacyfLTKTsc9S. Run with `npm run build`.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import { siClaudecode, siNodedotjs, siPython, siReact, siTypescript } from "simple-icons";

const FONT_DIR = new URL(".fonts/", import.meta.url);
const ASSETS = new URL("../assets/", import.meta.url);

// An old user agent makes Google Fonts serve static TTFs instead of WOFF2, the plainest format to cache and parse.
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500&family=Martian+Mono:wght@400&family=Kalam:wght@400";
const WANT = { sans: ["Instrument Sans", 400], sansMedium: ["Instrument Sans", 500], mono: ["Martian Mono", 400], hand: ["Kalam", 400] };

async function loadFonts() {
  await mkdir(FONT_DIR, { recursive: true });
  let css;
  const fonts = {};
  for (const [key, [family, weight]] of Object.entries(WANT)) {
    const file = new URL(`${family.replaceAll(" ", "-").toLowerCase()}-${weight}.ttf`, FONT_DIR);
    if (!existsSync(file)) {
      css ??= await (await fetch(FONT_CSS, { headers: { "user-agent": "Mozilla/4.0" } })).text();
      const face = css.split("@font-face").find(b => b.includes(`'${family}'`) && b.includes(`font-weight: ${weight};`));
      const url = face?.match(/url\((\S+?\.ttf)\)/)?.[1];
      if (!url) throw new Error(`No TTF for ${family} ${weight} in Google Fonts CSS`);
      await writeFile(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    }
    fonts[key] = fontkit.create(await readFile(file));
  }
  return fonts;
}

const F = await loadFonts();

// Text ships as outlines so the typeface renders exactly; GitHub serves SVGs as images, which can't load web fonts.
// fontkit shapes like the browser (Instrument Sans kerns through GPOS extension lookups), so spacing and centering
// match the prototype. opentype.js 2.0.0 was dropped: it crashed on these fonts' ccmp, skipped their kerning, and
// wrote NaN into paths when rounding.
const SVG_CMD = { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" };
function outline(font, text, x, y, size, { tracking = 0, anchor = "start" } = {}) {
  const run = font.layout(text);
  if (run.glyphs.some(g => !g.id)) throw new Error(`Font is missing a glyph in "${text}"`);
  const s = size / font.unitsPerEm;
  const advances = run.positions.map(p => p.xAdvance * s + tracking);
  // Tracking after the last glyph adds no ink, so it stays out of the width used for centering.
  const width = advances.reduce((sum, a) => sum + a, 0) - tracking;
  let pen = anchor === "middle" ? x - width / 2 : x;
  // Font units are y-up. One decimal keeps outlines within 0.06px even at the largest render scale (1.22x)
  // and saves ~40 KB per file over two.
  const d = run.glyphs.map((g, i) => {
    const ox = pen + run.positions[i].xOffset * s, oy = y - run.positions[i].yOffset * s;
    pen += advances[i];
    return g.path.commands.map(c =>
      SVG_CMD[c.command] + c.args.map((v, j) => +(j % 2 ? oy - v * s : ox + v * s).toFixed(1)).join(" ")).join("");
  }).join("");
  return { d, width };
}
const txt = (font, text, x, y, size, attrs, opts) => `<path ${attrs} d="${outline(F[font], text, x, y, size, opts).d}"/>`;
// A line's ink edges and advance at 1px. Lines sit on the dot grid by their ink, not their pen origin, so a
// glyph's side bearing never shows as a nudge against the dots.
function ink(font, text) {
  const run = F[font].layout(text), s = 1 / F[font].unitsPerEm;
  const adv = run.positions.reduce((sum, p) => sum + p.xAdvance * s, 0);
  return { left: run.glyphs[0].bbox.minX * s, right: adv - run.positions.at(-1).xAdvance * s + run.glyphs.at(-1).bbox.maxX * s, adv };
}
const fitTo = ([x0, x1], { left, right }) => (x1 - x0) / (right - left);
// GitHub's README column shows the header at ~0.7x; at() turns an on-screen size into header units. The page's
// type scale is 30/16/13/11px on screen.
const at = px => +(px / 0.7).toFixed(1);

const T = 21; // diagram: seven 3-second stages, long enough to read each status line
const TN = 9; // name: three 3-second frames

const GLYPHS = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
};
// Slot positions are fixed so the S-A-I dots sit in the same place in every frame.
const FRAMES = [
  { 3: "S", 4: "A", 5: "I", 6: "R", 7: "I", 8: "T", 9: "H", 10: "I", 11: "K" },
  { 3: "S", 4: "A", 5: "I" },
  { 0: "H", 1: "E", 2: "Y", 3: "S", 4: "A", 5: "I", 6: ".", 7: "D", 8: "E", 9: "V" },
];
// The dot grid in its own units; panel() scales it into a page column.
const COLS = 73, ROWS = 9, PITCH = 8.8, X0 = 48, Y0 = 86;
// The faint dots' outer edges.
const GRID = [X0 - 1.4, X0 + (COLS - 1) * PITCH + 1.4];
// Desktop splits 50/50: equal margins outside and between two equal columns, the name's and the diagram's.
const M = 46.6, COL = (1200 - 3 * M) / 2, LEFT = [M, M + COL], RIGHT = [1200 - M - COL, 1200 - M];

function litAt(f, glyphRow, col) {
  const c = col - 1;
  if (c < 0 || c % 6 === 5) return 0;
  const g = FRAMES[f][Math.floor(c / 6)];
  return g ? Number(GLYPHS[g][glyphRow][c % 6] === "1") : 0;
}

// Frame k owns [k/3, (k+1)/3) of the loop; a change of state flickers before it settles.
function keyframesFor(mask) {
  const st = k => (mask >> k) & 1;
  const starts = [0, 100 / 3, 200 / 3];
  const STEP = 7.2 / TN; // 72ms per flicker step, independent of loop length
  const kf = [];
  for (let k = 0; k < 3; k++) {
    const now = st(k), before = st((k + 2) % 3);
    if (now === before) { kf.push([starts[k], now]); continue; }
    [now, before, now, before, now].forEach((v, i) => kf.push([starts[k] + i * STEP, v]));
  }
  kf.push([100, st(2)]);
  return `@keyframes dm${mask}{${kf.map(([p, v]) => `${p.toFixed(2)}%{opacity:${v}}`).join("")}}` +
         `.dm-m${mask}{opacity:${st(0)};animation:dm${mask} ${TN}s step-end infinite}`;
}

function dotPanel() {
  let out = "";
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (X0 + c * PITCH).toFixed(1), y = (Y0 + r * PITCH).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="1.4" class="faint"/>`;
    if (r < 1 || r > 7) continue;
    const mask = litAt(0, r - 1, c) | (litAt(1, r - 1, c) << 1) | (litAt(2, r - 1, c) << 2);
    if (!mask) continue;
    out += mask === 7
      ? `<circle cx="${x}" cy="${y}" r="3.3" class="acc"/>`
      : `<circle cx="${x}" cy="${y}" r="3.3" class="ink dm dm-m${mask}"/>`;
  }
  return out;
}
// The panel scaled so its grid spans [x0, x1], with its first row of dots at y.
function panel([x0, x1], y) {
  const k = (x1 - x0) / (GRID[1] - GRID[0]);
  return `<g transform="translate(${+(x0 - GRID[0] * k).toFixed(2)} ${+(y - Y0 * k).toFixed(2)}) scale(${+k.toFixed(4)})">${dotPanel()}</g>`;
}

const on = (a, b) => `<animate attributeName="opacity" values="0;1;0" keyTimes="0;${a};${b}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/>`;
const packet = (d, a, b) =>
  `<circle r="3.6" class="acc pk" opacity="0">${on(a, b)}` +
  `<animateMotion dur="${T}s" repeatCount="indefinite" path="${d}" keyPoints="0;0;1;1" keyTimes="0;${a};${b};1" calcMode="linear"/></circle>`;
const glow = (shape, windows) =>
  `<g class="pk" opacity="0">${shape}<animate attributeName="opacity" values="0;${windows.map(() => "1;0").join(";")}" ` +
  `keyTimes="0;${windows.flat().join(";")}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></g>`;

// The graph is drawn in diagram units and placed by translate(tx ty) scale(s); the heading and readout stay in
// page units so their text keeps its size on the type scale however large the graph is drawn.
function orchestration(s = 1, [tx, ty] = [0, 0]) {
  const ys = [94, 132, 170, 208, 246];
  const fanOut = ys.map(y => `M736 170 C768 170 768 ${y} 800 ${y}`);
  const fanIn = ys.map(y => `M800 ${y} C834 ${y} 834 170 868 170`);
  // Seven equal stages; S(p, x) is the loop time at fraction x through stage p.
  const S = (p, x) => +((p + x) / 7).toFixed(4);
  const leave = [0, 0.1, 0.2, 0.05, 0.15].map(x => S(1, x));
  const debaters = [[958, 136], [987.4, 187], [928.6, 187]];
  const ring = "M924 170 A34 34 0 1 1 992 170 A34 34 0 1 1 924 170";
  const ringB = "M992 170 A34 34 0 1 1 924 170 A34 34 0 1 1 992 170";
  const reject = "M1052 161 C1052 100 958 92 958 131";

  const wires = [...fanOut, ...fanIn].map(d => `<path d="${d}" class="rule" stroke-width="1.5"/>`).join("") +
    `<path d="M868 170 L924 170 M992 170 L1044 170 M1060 170 L1128 170" class="rule" stroke-width="1.5"/>` +
    `<circle cx="958" cy="170" r="34" class="rule" stroke-width="1.5"/>` +
    `<path d="${reject}" class="rule" stroke-width="1.5" stroke-dasharray="4 4"/>`;

  // One shape per model family, so the fan-out reads as cross-model at a glance.
  const models = ["claude", "claude", "codex", "grok", "gemini"];
  const shape = (m, x, y, cls) => {
    if (m === "codex") return `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" class="${cls}" stroke-width="1.5"/>`;
    if (m === "grok") return `<polygon points="${x},${y - 6} ${x + 5.5},${y + 4.5} ${x - 5.5},${y + 4.5}" class="${cls}" stroke-width="1.5"/>`;
    if (m === "gemini") return `<polygon points="${[0, 60, 120, 180, 240, 300].map(d => `${(x + 5.5 * Math.cos(d * Math.PI / 180)).toFixed(2)},${(y + 5.5 * Math.sin(d * Math.PI / 180)).toFixed(2)}`).join(" ")}" class="${cls}" stroke-width="1.5"/>`;
    return `<circle cx="${x}" cy="${y}" r="5" class="${cls}" stroke-width="1.5"/>`;
  };
  const researchers = ys.map((y, i) => shape(models[i], 800, y, "ground s-ink")).join("");
  const nodes =
    `<circle cx="736" cy="170" r="6" class="ink"/>` + researchers +
    `<circle cx="868" cy="170" r="6" class="ground s-ink" stroke-width="1.5"/>` +
    debaters.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5" class="ground ${i === 0 ? "s-acc" : "s-ink"}" stroke-width="1.5"/>`).join("") +
    `<polygon points="1052,162 1060,170 1052,178 1044,170" class="ground s-ink" stroke-width="1.5"/>` +
    `<circle cx="1136" cy="170" r="16" class="s-acc" fill="none" stroke-width="1.5" opacity="0.35"/>` +
    `<circle cx="1136" cy="170" r="8" class="acc"/>`;

  const lights =
    ys.map((y, i) => glow(shape(models[i], 800, y, "acc"), [[S(0, 0.35), leave[i]]])).join("") +
    glow(`<circle cx="868" cy="170" r="6" class="acc"/>`, [[S(1, 0.5), S(2, 0)]]) +
    glow(`<circle cx="958" cy="136" r="5" class="acc"/>`, [[S(2, 0.4), S(2, 0.55)], [S(3, 0.85), S(4, 0.25)]]) +
    glow(`<circle cx="987.4" cy="187" r="5" class="acc"/>`, [[S(2, 0.6), S(2, 0.75)], [S(4, 0.5), S(4, 0.65)]]) +
    glow(`<circle cx="928.6" cy="187" r="5" class="acc"/>`, [[S(2, 0.2), S(2, 0.35)], [S(2, 0.8), S(2, 0.95)], [S(4, 0.7), S(4, 0.85)]]) +
    glow(`<polygon points="1052,162 1060,170 1052,178 1044,170" class="acc"/>`, [[S(3, 0.15), S(3, 0.4)], [S(5, 0.15), S(6, 0)]]);

  const packets =
    fanOut.map(d => packet(d, S(0, 0.05), S(0, 0.35))).join("") +
    fanIn.map((d, i) => packet(d, leave[i], +(leave[i] + 0.3 / 7).toFixed(4))).join("") +
    packet("M868 170 L924 170", S(2, 0), S(2, 0.15)) +
    packet(ring, S(2, 0.15), S(2, 0.95)) + packet(ringB, S(2, 0.15), S(2, 0.95)) +
    packet("M992 170 L1044 170", S(3, 0), S(3, 0.15)) +
    packet(reject, S(3, 0.4), S(3, 0.85)) +
    packet("M958 136 A34 34 0 0 1 992 170", S(4, 0.25), S(4, 0.45)) +
    packet("M992 170 L1044 170", S(5, 0), S(5, 0.15)) +
    packet("M1060 170 L1128 170", S(6, 0), S(6, 0.25));

  const pulse =
    `<circle cx="1136" cy="170" r="8" class="s-acc pk" fill="none" stroke-width="1.5" opacity="0">` +
    `<animate attributeName="r" values="8;8;24" keyTimes="0;${S(6, 0.25)};1" dur="${T}s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0;0;0.7;0" keyTimes="0;${S(6, 0.25)};${S(6, 0.27)};1" dur="${T}s" repeatCount="indefinite"/></circle>`;

  const phases = [
    ["Researching", "Cross-model: 2 Opus, 1 Codex, 1 Grok, 1 Gemini."],
    ["Merging", "Findings merge into one answer, ranked by agreement."],
    ["Debating", "Three agents debate it. One plays devil's advocate."],
    ["Reviewing", "A reviewer rejects the draft and sends it back."],
    ["Debating", "Round 2: the agents fix what the reviewer flagged."],
    ["Reviewing", "The revised draft passes review."],
    ["Handing off", "A human reads the summary and makes the call."],
  ].map(([title, line], p) => [S(p, 0), S(p, 1), title, line]);
  const f = n => +n.toFixed(4);
  const fi = 0.3 / T, fo = 0.25 / T;
  const fade = (a, b) => {
    const pts = a === 0 ? [[0, 0], [f(fi), 1], [f(b - fo), 1], [b, 0], [1, 0]]
      : b === 1 ? [[0, 0], [a, 0], [f(a + fi), 1], [f(1 - fo), 1], [1, 0]]
      : [[0, 0], [a, 0], [f(a + fi), 1], [f(b - fo), 1], [b, 0], [1, 0]];
    return `<animate attributeName="opacity" values="${pts.map(p => p[1]).join(";")}" keyTimes="${pts.map(p => p[0]).join(";")}" dur="${T}s" repeatCount="indefinite"/>`;
  };
  // 3x3 pixel loader with a chevron wavefront; the last stage draws it solid because the work is done.
  const cells = (x, y, animated) => Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const style = animated ? ` style="animation-delay:${(c + Math.abs(r - 1)) * 90}ms"` : "";
    return `<rect x="${x + c * 7}" y="${y + r * 7}" width="5" height="5" rx="1" class="acc${animated ? " px" : ""}"${style}/>`;
  }).join("");
  // Title widths come from the real font so each loader + title pair centers exactly under the diagram.
  // The heading sits 24 above the top label's baseline (y=82) and the title 40 below the bottom node (y=252).
  const CX = tx + s * 944, LOADER = 19, GAP = 12;
  const headY = +(ty + s * 82 - 24).toFixed(1), titleY = +(ty + s * 252 + 40).toFixed(1);
  const shimmer =
    `<defs><linearGradient id="shim" gradientUnits="userSpaceOnUse" x1="766" y1="0" x2="966" y2="0" spreadMethod="repeat">` +
    `<stop offset="0" class="st-i"/><stop offset="0.35" class="st-i"/><stop offset="0.5" class="st-a"/><stop offset="0.65" class="st-i"/><stop offset="1" class="st-i"/>` +
    `<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="200 0" dur="1.4s" repeatCount="indefinite"/>` +
    `</linearGradient></defs>`;
  const xs = phases.map(([, , title]) => +(CX - (LOADER + GAP + outline(F.sansMedium, title, 0, 0, at(13)).width) / 2).toFixed(1));
  const readout = phases.map(([a, b, title, line], p) =>
    `<g class="pk" opacity="0">${fade(a, b)}` +
    txt("sansMedium", title, xs[p] + LOADER + GAP, titleY, at(13), `fill="url(#shim)"`) +
    txt("sans", line, CX, titleY + 27, at(13), `class="ink"`, { anchor: "middle" }) + `</g>`).join("");
  // One loader lives outside the per-stage fades so it never blinks out between stages; it slides to the
  // next title's position while the old title fades out, then swaps to solid (no fade) for the last stage.
  const slide = [[0, xs[0]], ...phases.flatMap(([, b], p) => [[f(b - fo), xs[p]], [b, xs[(p + 1) % 7]]])];
  const loader =
    `<g class="pk" transform="translate(${xs[0]} 0)">` +
    `<animateTransform attributeName="transform" type="translate" values="${slide.map(([, x]) => `${x} 0`).join(";")}" ` +
    `keyTimes="${slide.map(([t]) => t).join(";")}" calcMode="spline" ` +
    `keySplines="${slide.slice(1).map((_, i) => i % 2 ? "0.4 0 0.2 1" : "0 0 1 1").join(";")}" dur="${T}s" repeatCount="indefinite"/>` +
    `<g>${cells(0, titleY - 16, true)}<animate attributeName="opacity" values="1;0" keyTimes="0;${S(6, 0)}" calcMode="discrete" dur="${T}s" repeatCount="indefinite"/></g>` +
    glow(cells(0, titleY - 16, false), [[S(6, 0), 1]]) + `</g>`;

  // Legend points surface beside their nodes only while that stage runs, so the diagram explains itself.
  const NAMES = { claude: "Opus", grok: "Grok", codex: "Codex", gemini: "Gemini" };
  const note = (x, y, text, windows, cls = "lbl") => windows.map(([a, b]) =>
    `<g class="pk" opacity="0">${fade(a, b)}${txt("mono", text, x, y, at(11) / s, `class="${cls}"`, { anchor: "middle" })}</g>`).join("");
  const notes =
    ys.map((y, i) => note(800, y - 12, NAMES[models[i]], [[S(0, 0), S(1, 0)]])).join("") +
    // Sits under the ring, out of the packets' path; the accent color ties it to the advocate's accent ring.
    note(958, 224, "devil's advocate", [[S(2, 0), S(3, 0)], [S(4, 0), S(5, 0)]], "lbl acc") +
    note(1005, 98, "rejected", [[S(3, 0), S(4, 0)]]) +
    // Low enough that its halo clears the debater node at (987.4, 187); it never shows with "devil's advocate".
    note(1052, 204, "review gate", [[S(3, 0), S(4, 0)], [S(5, 0), S(6, 0)]]) +
    note(1136, 208, "human", [[S(6, 0), S(7, 0)]]);

  // Same on-screen size and tracking as the stack strip's DAILY DRIVERS, which GitHub shows at 1:1.
  const heading = txt("mono", "MY MULTI-AGENT WORKFLOW", CX, headY, at(13), `class="ink"`, { tracking: at(2), anchor: "middle" });

  const graph = wires + nodes + lights + notes + packets + pulse;
  // An unscaled graph skips the group, so the phone layout's markup stays as it was.
  const placed = s === 1 && !tx && !ty ? graph : `<g transform="translate(${+tx.toFixed(2)} ${+ty.toFixed(2)}) scale(${+s.toFixed(4)})">${graph}</g>`;
  return shimmer + heading + placed + readout + loader;
}

// Desktop sets the headline as one line fitted to the grid; phones keep these two lines.
const HEADLINE = ["I build products, AI tooling,", "and the workflows that run them."];
const headline = (lines, left, y, size) => lines.map((line, i) =>
  txt("sans", line, left - ink("sans", line).left * size, y + i * size * 1.25, size, `class="ink"`)).join("");
// The tagline acts out its claim once on load: the sentence types out, then a pen strikes "lost" and writes
// "fluent" in by hand. Ported from 21st.dev's Second Draft Text (@ham7a311) to one-shot SMIL, since GitHub's
// <img> runs no JS.
const DRAFT = { lead: "Fast with AI, ", struck: "lost", fix: "fluent", tail: " without it." };
// "fluent" is set at 12/11 of the sans size, the ratio it was tuned at (24 over 22), so the line scales linearly.
const HAND = 12 / 11;
// The finished line's ink at 1px, laid out the way tagline() places it: lead, struck word, a space, fix, tail.
function draftInk() {
  const { lead, struck, fix, tail } = DRAFT;
  const pre = ink("sans", lead).adv + ink("sans", struck).adv + ink("sans", " ").adv;
  return { left: ink("sans", lead).left, right: pre + ink("hand", fix).adv * HAND + ink("sans", tail).right };
}
const STRIKE = "M2 13 C 22 10, 40 12, 60 9 S 88 8, 98 6"; // drawn in a 100x20 box
const FLOURISH = "M3 9 C 30 15, 70 15, 104 8 C 112 6, 117 5, 116 10 C 114 16, 96 18, 84 15"; // 120x24 box

// Second Draft's human typing rhythm, with a fixed hash in place of Math.random so the build stays byte-reproducible.
const jitter = i => ((i * 2654435761) >>> 0) / 2 ** 32;
const pace = (ch, prev, i) => {
  let ms = 55 + jitter(i) * 55;
  if (prev === " ") ms += 40 + jitter(i + 97) * 60;
  if (/[,.]/.test(prev)) ms += 220;
  return ch === " " ? ms * 0.7 : ms;
};
// Remaps the path's coordinates into the target box rather than scaling it, which would stretch the stroke width too.
const fit = (d, w, h, x0, y0, x1, y1) => d.replace(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g, (_, a, b) =>
  `${+(x0 + a / w * (x1 - x0)).toFixed(1)} ${+(y0 + b / h * (y1 - y0)).toFixed(1)}`);

function tagline(left, y, size) {
  const { lead, struck, fix, tail } = DRAFT;
  const hand = size * HAND, x = left - ink("sans", lead).left * size;
  const r = n => +n.toFixed(3), k = n => +n.toFixed(4);
  const u = n => r(n * size / 18); // the offsets below were tuned at 18px; this keeps the pen marks in proportion
  const w = (font, text, px) => +outline(F[font], text, 0, 0, px).width.toFixed(1);
  const wStruck = w("sans", struck, size), wFix = w("hand", fix, hand);
  const xStruck = x + w("sans", lead, size), xFix = +(xStruck + wStruck + w("sans", " ", size)).toFixed(1);
  const dx = +(xFix + wFix - xStruck - wStruck).toFixed(1); // the tail moves over by a space plus the fix

  // The typing clip widens one character at a time and the caret rides its edge.
  const typed = lead + struck + tail;
  // At the component's full pace this sentence alone takes ~3s to type; 0.65x keeps the whole revision under 5s.
  let t = 0.3;
  const steps = [...typed].map((ch, i) => [t += pace(ch, i ? typed[i - 1] : " ", i) * 0.65 / 1000, w("sans", typed.slice(0, i + 1), size)]);
  const typedAt = steps.at(-1)[0], typeDur = r(typedAt + 0.1);
  const keyTimes = `0;${steps.map(([s]) => k(s / typeDur)).join(";")}`;
  const widths = [0, ...steps.slice(0, -1).map(([, x1]) => r(x1 + u(4))), r(steps.at(-1)[1] + dx + u(8))];
  // One blink once the line is typed, then the caret leaves and the pen takes over.
  const blinkOff = typedAt + 0.35, blinkOn = blinkOff + 0.3, caretGone = r(blinkOn + 0.3);
  const strikeAt = caretGone, writeAt = r(strikeAt + 0.45), flourishAt = r(writeAt + 0.75);

  const ease = `calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze"`;
  const strike = fit(STRIKE, 100, 20, xStruck - u(1), y - u(13), xStruck + wStruck + u(1), y - u(1));
  const flourish = fit(FLOURISH, 120, 24, xFix - u(2), y - u(2), xFix + wFix + u(4), y + u(10));
  const pen = (d, width) => `<path d="${d}" class="s-acc" fill="none" stroke-width="${width}" stroke-linecap="round"`;
  // pathLength="1" lets one dash cover the whole stroke; offsetting it just past 1 hides it, round caps included.
  const draw = (d, width, begin, dur) => `${pen(d, width)} pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="1.02">` +
    `<animate attributeName="stroke-dashoffset" values="1.02;0" ${ease} begin="${begin}s" dur="${dur}s"/></path>`;
  const words = `<use href="#tg-lead" class="ink"/><use href="#tg-struck" class="ink"/>`;

  const defs = `<defs>` +
    txt("sans", lead, x, y, size, `id="tg-lead"`) + txt("sans", struck, xStruck, y, size, `id="tg-struck"`) +
    txt("sans", tail, xStruck + wStruck, y, size, `id="tg-tail"`) + txt("hand", fix, xFix, y, hand, `id="tg-fix"`) +
    `<clipPath id="tg-type"><rect x="${r(x - u(4))}" y="${r(y - u(20))}" width="0" height="${u(28)}">` +
    `<animate attributeName="width" values="${widths.join(";")}" keyTimes="${keyTimes}" calcMode="discrete" dur="${typeDur}s" fill="freeze"/></rect></clipPath>` +
    `<clipPath id="tg-write"><rect x="${r(xFix - u(3))}" y="${r(y - u(24))}" width="0" height="${u(34)}">` +
    `<animate attributeName="width" values="0;${r(wFix + u(8))}" ${ease} begin="${writeAt}s" dur="0.7s"/></rect></clipPath></defs>`;

  const animated = `<g class="pk"><g clip-path="url(#tg-type)">${words}` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;${dx} 0" ${ease} begin="${writeAt}s" dur="0.4s"/>` +
    `<use href="#tg-tail" class="ink"/></g></g>` +
    `<rect x="${r(x + u(1))}" y="${r(y - u(14))}" width="${u(1.5)}" height="${u(18)}" class="ink">` +
    `<animate attributeName="x" values="${[x, ...steps.map(([, x1]) => x + x1)].map(v => r(v + u(1))).join(";")}" keyTimes="${keyTimes}" calcMode="discrete" dur="${typeDur}s" fill="freeze"/>` +
    `<animate attributeName="opacity" values="1;0;1;0" keyTimes="0;${k(blinkOff / caretGone)};${k(blinkOn / caretGone)};1" calcMode="discrete" dur="${caretGone}s" fill="freeze"/></rect>` +
    draw(strike, u(1.8), strikeAt, 0.3) + `<use href="#tg-fix" class="acc" clip-path="url(#tg-write)"/>` + draw(flourish, u(1.5), flourishAt, 0.45) + `</g>`;
  // SMIL ignores prefers-reduced-motion, so reduced motion swaps in the finished revision drawn without animation.
  const still = `<g class="tg-still">${words}<use href="#tg-tail" x="${dx}" class="ink"/><use href="#tg-fix" class="acc"/>` +
    `${pen(strike, u(1.8))}/>${pen(flourish, u(1.5))}/></g>`;
  return defs + animated + still;
}

// The graph inks x 730–1152 in diagram units and scales to fill the right column, keeping its heading at y=58.
// The left column (panel, headline, tagline) centers as one block on the right column's middle (y ≈ 206), with
// equal gaps from the panel to the headline's caps and from the headline to the tagline's caps.
const DS = (RIGHT[1] - RIGHT[0]) / (1152 - 730);
const header = () =>
  panel(LEFT, 118.9) +
  headline([HEADLINE.join(" ")], LEFT[0], 222.7, fitTo(LEFT, ink("sans", HEADLINE.join(" ")))) +
  tagline(LEFT[0], 278.4, fitTo(LEFT, draftInk())) +
  orchestration(DS, [RIGHT[0] - DS * 730, 82 - DS * 82]);

// Phones stack the two blocks: side by side, GitHub's 263px README would shrink the status line to ~4px.
// The dot panel spans the 16-unit margins with its first row at y=24. The diagram is reused at 0.9x, small
// enough that its widest status line fits the same margins.
const PHONE_GRID = [16, 444];
const headerPhone = () =>
  panel(PHONE_GRID, 24) +
  headline(HEADLINE, 16, 108.3, 22) +
  tagline(16, 176.7, fitTo(PHONE_GRID, draftInk())) +
  `<path d="M16 209 H444" class="rule" stroke-width="1.5"/>` +
  `<g transform="translate(-619.6 201) scale(0.9)">${orchestration()}</g>`;

// simple-icons over svgl (21st.dev's logo source): each mark is one 24x24 path in a single color, where svgl
// ships brand colors in layered gradients and masks.
const STACK = [siTypescript, siReact, siNodedotjs, siPython, siClaudecode];
const LOGO = 32, ROW = 82;
// Unlike the header, the strip shows at 1:1, so 13px captions land at 13px. On phones five columns would
// shrink to ~0.44x in GitHub's 263px column, so the phone layout wraps to three.
function stack(cols, pitch) {
  const w = cols * pitch, rows = Math.ceil(STACK.length / cols);
  const label = txt("mono", "DAILY DRIVERS", w / 2, 22, 13, `class="ink"`, { tracking: 2, anchor: "middle" });
  const items = STACK.map((icon, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, STACK.length - row * cols);
    const cx = (w - inRow * pitch) / 2 + (i % cols + 0.5) * pitch, top = 44 + row * ROW;
    return `<g class="si" style="animation-delay:${150 + i * 100}ms">` +
      `<path transform="translate(${cx - LOGO / 2} ${top}) scale(${+(LOGO / 24).toFixed(4)})" d="${icon.path}"/>` +
      txt("mono", icon.title, cx, top + LOGO + 22, 13, `class="ink"`, { anchor: "middle" }) + `</g>`;
  }).join("");
  return [`0 0 ${w} ${108 + (rows - 1) * ROW}`, label + items];
}

// Text is ink at rest and accent while live or revised, with no gray tier. The accent is GitHub's link blue so
// the SVGs and the README's links share one blue.
const PALETTES = {
  light: { ink: "#1f2328", rule: "#c8d1da", faint: "#dce2e9", acc: "#0969da", ground: "#ffffff" },
  dark: { ink: "#f0f6fc", rule: "#3d444d", faint: "#1c222b", acc: "#4493f8", ground: "#0d1117" },
};
// ground matches GitHub's page background so node fills and label halos cut cleanly through the wires.
const style = p =>
  `.ink{fill:${p.ink}}.acc{fill:${p.acc}}.faint{fill:${p.faint}}.ground{fill:${p.ground}}` +
  `.rule{stroke:${p.rule};fill:none}.s-ink{stroke:${p.ink}}.s-acc{stroke:${p.acc}}.st-i{stop-color:${p.ink}}.st-a{stop-color:${p.acc}}` +
  `.lbl{fill:${p.ink};stroke:${p.ground};stroke-width:4px;stroke-linejoin:round;paint-order:stroke}.lbl.acc{fill:${p.acc}}` +
  `.px{opacity:.18;animation:px 650ms ease-in-out infinite}@keyframes px{0%,100%{opacity:.18}50%{opacity:1}}.tg-still{display:none}` +
  [1, 2, 3, 4, 5, 6].map(keyframesFor).join("") +
  // Last, so it overrides the per-mask animation rules: frozen SAIRITHIK, full diagram, finished tagline, no packets or readout.
  `@media (prefers-reduced-motion:reduce){.dm,.px{animation:none}.pk{display:none}.tg-still{display:inline}}`;
// Each mark rises in blue and settles to ink, once. Logos inherit the group's fill; captions set their own
// .ink so they stay out of the blue. The base rule is the finished state, so reduced motion only drops the animation.
const stackStyle = p =>
  `.ink{fill:${p.ink}}.si{fill:${p.ink};animation:si 700ms cubic-bezier(.2,.7,.2,1) both}` +
  `@keyframes si{0%{opacity:0;transform:translateY(6px);fill:${p.acc}}35%{opacity:1;transform:none;fill:${p.acc}}100%{fill:${p.ink}}}` +
  `@media (prefers-reduced-motion:reduce){.si{animation:none}}`;

const TITLE = "Sairithik Komuravelly";
const DESC = "Sairithik, in dot-matrix letters that change to Sai and then to heysai.dev. " +
  "I build products, AI tooling, and the workflows that run them. " +
  "Fast with AI, lost without it, with lost struck out and fluent written in by hand. " +
  "A diagram shows one ticket fanning out to five research agents, merging, going through " +
  "a three-agent debate and a review gate that sends it back once, then reaching a human.";

const HEADER = { title: TITLE, desc: DESC, css: style };
const STRIP = { title: "Daily drivers", desc: "TypeScript, React, Node.js, Python, and Claude Code, the tools I use every day.", css: stackStyle };

const svg = (viewBox, body, { title, desc }, css) => {
  const [, , w, h] = viewBox.split(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" role="img" aria-labelledby="t d">` +
    `<title id="t">${title}</title><desc id="d">${desc}</desc><style>${css}</style>${body}</svg>\n`;
};

// Browsers drop SMIL with invalid timing without any error, so a bad edit would otherwise ship a frozen diagram.
// Linear and spline timing must end at exactly 1; discrete may stop early; animateMotion's default (paced) ignores keyTimes.
function checkSmil(name, markup) {
  for (const [tag, kind] of markup.matchAll(/<(animate\w*)\b[^>]*>/g)) {
    const attr = k => tag.match(new RegExp(`\\s${k}="([^"]*)"`))?.[1];
    const keyTimes = attr("keyTimes");
    if (!keyTimes) continue;
    const t = keyTimes.split(";").map(Number);
    const count = (attr("keyPoints") ?? attr("values") ?? "").split(";").length;
    const mode = attr("calcMode") ?? (kind === "animateMotion" ? "paced" : "linear");
    const ok = t[0] === 0 && t.every((v, i) => i === 0 || v >= t[i - 1]) && t.length === count &&
      (mode === "discrete" ? t.at(-1) <= 1 : mode !== "paced" && t.at(-1) === 1);
    if (!ok) throw new Error(`${name}: invalid SMIL timing in ${tag}`);
  }
}

await mkdir(ASSETS, { recursive: true });
const layouts = {
  header: ["0 40 1200 332", header(), HEADER],
  "header-phone": ["0 16 460 484", headerPhone(), HEADER],
  stack: [...stack(5, 120), STRIP],
  "stack-phone": [...stack(3, 100), STRIP],
};
for (const [layout, [viewBox, body, meta]] of Object.entries(layouts)) {
  checkSmil(layout, body);
  for (const [theme, palette] of Object.entries(PALETTES)) {
    const file = `${layout}-${theme}.svg`;
    const out = svg(viewBox, body, meta, meta.css(palette));
    await writeFile(new URL(file, ASSETS), out);
    console.log(`${file}  ${(out.length / 1024).toFixed(0)} KB`);
  }
}
