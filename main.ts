// news-image-20261123 — "The world in one day"
// Draws a newspaper front page summing up Monday 23 November 2026:
// the Iran war widening in the Gulf, Ukraine's strike off Libya,
// COP31 collapsing, Gaza's toxic toll, Delta's outage, Alcaraz,
// and Asian markets sliding. Pure Node 22 stdlib: a hand-built
// stroke font, a software rasteriser and a hand-rolled PNG encoder.
// No network, no downloads, fully deterministic — every run writes
// byte-identical output.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4); // RGBA

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 233];
const INK: RGB = [22, 35, 63];
const RED: RGB = [178, 39, 46];
const GOLD: RGB = [201, 162, 39];
const TEAL: RGB = [31, 111, 107];
const BLUE: RGB = [43, 90, 160];
const GREEN: RGB = [46, 125, 66];
const GREY: RGB = [74, 84, 102];
const WHITE: RGB = [255, 255, 255];
const ORANGE: RGB = [232, 116, 28];
const YELLOW: RGB = [245, 197, 66];
const SKY: RGB = [214, 230, 238];
const SEA: RGB = [38, 110, 138];

function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = c[0];
    px[i * 4 + 1] = c[1];
    px[i * 4 + 2] = c[2];
    px[i * 4 + 3] = 255;
  }
}

function setPx(x: number, y: number, c: RGB): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  const rr = Math.max(0, Math.round(r));
  const x0 = Math.max(0, Math.round(cx) - rr);
  const x1 = Math.min(W - 1, Math.round(cx) + rr);
  const y0 = Math.max(0, Math.round(cy) - rr);
  const y1 = Math.min(H - 1, Math.round(cy) + rr);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr * rr + rr * 0.5) setPx(x, y, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / 0.6));
  const r = Math.max(0.6, w / 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    disc(x0 + dx * t, y0 + dy * t, r, c);
  }
}

// Scanline polygon fill (even-odd rule), points as flat [x,y,...].
function poly(points: number[], c: RGB): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < points.length; i += 2) {
    minY = Math.min(minY, points[i]);
    maxY = Math.max(maxY, points[i]);
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  const n = points.length / 2;
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const ax = points[i * 2];
      const ay = points[i * 2 + 1];
      const bx = points[((i + 1) % n) * 2];
      const by = points[((i + 1) % n) * 2 + 1];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) setPx(x, y, c);
    }
  }
}

function circleOutline(cx: number, cy: number, r: number, w: number, c: RGB): void {
  const steps = Math.max(24, Math.round(r * 6));
  for (let s = 0; s < steps; s++) {
    const a0 = (s / steps) * Math.PI * 2;
    const a1 = ((s + 1) / steps) * Math.PI * 2;
    line(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, w, c);
  }
}

// ------------------------------------------------------- stroke font
// Single-stroke capitals + digits on a 6-wide, 9-tall grid (y 0 = top).
// Each glyph is a list of strokes; each stroke a flat polyline [x,y,...].
const GLYPHS: Record<string, number[][]> = {
  A: [[0, 9, 3, 0, 6, 9], [1.4, 6, 4.6, 6]],
  B: [[0, 0, 0, 9], [0, 0, 3.6, 0, 5.4, 1.6, 5.4, 3, 3.8, 4.5, 0, 4.5], [3.8, 4.5, 5.4, 6, 5.4, 7.6, 3.8, 9, 0, 9]],
  C: [[5.6, 2, 4.2, 0, 1.8, 0, 0, 1.8, 0, 7.2, 1.8, 9, 4.2, 9, 5.6, 7]],
  D: [[0, 0, 0, 9, 3.4, 9, 5.6, 6.8, 5.6, 2.2, 3.4, 0, 0, 0]],
  E: [[5.6, 0, 0, 0, 0, 9, 5.6, 9], [0, 4.5, 4, 4.5]],
  F: [[5.6, 0, 0, 0, 0, 9], [0, 4.5, 4, 4.5]],
  G: [[5.6, 2, 4.2, 0, 1.8, 0, 0, 1.8, 0, 7.2, 1.8, 9, 4.2, 9, 5.6, 7, 5.6, 4.6, 3, 4.6]],
  H: [[0, 0, 0, 9], [6, 0, 6, 9], [0, 4.5, 6, 4.5]],
  I: [[3, 0, 3, 9], [1.2, 0, 4.8, 0], [1.2, 9, 4.8, 9]],
  J: [[5.6, 0, 5.6, 6.8, 4.2, 9, 1.8, 9, 0.4, 7.2]],
  K: [[0, 0, 0, 9], [5.6, 0, 0, 4.5, 5.6, 9]],
  L: [[0, 0, 0, 9, 5.6, 9]],
  M: [[0, 9, 0, 0, 3, 5, 6, 0, 6, 9]],
  N: [[0, 9, 0, 0, 6, 9, 6, 0]],
  O: [[1.8, 0, 4.2, 0, 6, 1.8, 6, 7.2, 4.2, 9, 1.8, 9, 0, 7.2, 0, 1.8, 1.8, 0]],
  P: [[0, 9, 0, 0, 3.8, 0, 5.6, 1.6, 5.6, 3, 3.8, 4.5, 0, 4.5]],
  Q: [[1.8, 0, 4.2, 0, 6, 1.8, 6, 7.2, 4.2, 9, 1.8, 9, 0, 7.2, 0, 1.8, 1.8, 0], [3.4, 5.6, 6, 9]],
  R: [[0, 9, 0, 0, 3.8, 0, 5.6, 1.6, 5.6, 3, 3.8, 4.5, 0, 4.5], [3.4, 4.5, 6, 9]],
  S: [[5.4, 2.2, 4, 0, 2, 0, 0.6, 1.4, 0.6, 3, 2.2, 4.5, 3.8, 4.5, 5.4, 6, 5.4, 7.4, 4, 9, 2, 9, 0.6, 7.4]],
  T: [[0, 0, 6, 0], [3, 0, 3, 9]],
  U: [[0, 0, 0, 7, 1.6, 9, 4.4, 9, 6, 7, 6, 0]],
  V: [[0, 0, 3, 9, 6, 0]],
  W: [[0, 0, 1.5, 9, 3, 4, 4.5, 9, 6, 0]],
  X: [[0, 0, 6, 9], [6, 0, 0, 9]],
  Y: [[0, 0, 3, 4.5, 6, 0], [3, 4.5, 3, 9]],
  Z: [[0, 0, 6, 0, 0, 9, 6, 9]],
  "0": [[1.8, 0, 4.2, 0, 6, 1.8, 6, 7.2, 4.2, 9, 1.8, 9, 0, 7.2, 0, 1.8, 1.8, 0]],
  "1": [[1.6, 1.8, 3.4, 0, 3.4, 9], [1, 9, 5.6, 9]],
  "2": [[0.6, 2.2, 1.8, 0, 4.2, 0, 5.6, 1.8, 5.6, 3.4, 0, 9, 6, 9]],
  "3": [[0.6, 2, 1.8, 0, 4.2, 0, 5.6, 1.8, 4.2, 4.5, 5.6, 6.4, 5.6, 7.4, 4.2, 9, 1.8, 9, 0.6, 7.2]],
  "4": [[4.6, 0, 0.4, 6.2, 5.6, 6.2], [4.6, 0, 4.6, 9]],
  "5": [[5.6, 0, 0.4, 0, 0.4, 4, 3.8, 4, 5.4, 5.6, 5.4, 7.4, 4, 9, 1.8, 9, 0.6, 7.4]],
  "6": [[5.4, 1.6, 4, 0, 1.8, 0, 0.4, 1.8, 0, 7, 1.6, 9, 4, 9, 5.6, 7.2, 5.6, 5.2, 4, 3.6, 1.8, 3.6, 0.6, 5]],
  "7": [[0, 0, 6, 0, 2.6, 9]],
  "8": [[2, 0, 4, 0, 5.6, 1.6, 5.6, 3, 4, 4.5, 2, 4.5, 0.4, 3, 0.4, 1.6, 2, 0], [2, 4.5, 4, 4.5, 5.6, 6, 5.6, 7.4, 4, 9, 2, 9, 0.4, 7.4, 0.4, 6, 2, 4.5]],
  "9": [[1.8, 0, 4, 0, 5.6, 1.6, 5.6, 4, 4, 6, 1.8, 6, 0.4, 4.4, 0.4, 2, 1.8, 0], [5.6, 4, 5.6, 7.4, 4.2, 9, 2.4, 9]],
  ".": [[3, 8.4, 3, 8.4]],
  ",": [[3, 7.8, 3, 7.8], [2.8, 8.6, 2, 10.6]],
  "-": [[0.6, 4.5, 5.4, 4.5]],
  ":": [[3, 3, 3, 3], [3, 7.6, 3, 7.6]],
  ";": [[3, 3, 3, 3], [3, 7.6, 3, 7.6], [2.8, 8.4, 2, 10.6]],
  "%": [[0.4, 0.4, 5.6, 8.6], [0.5, 2, 1.6, 0.9, 2.7, 2, 1.6, 3.1, 0.5, 2], [3.3, 7, 4.4, 5.9, 5.5, 7, 4.4, 8.1, 3.3, 7]],
  "/": [[5, 0, 1, 9]],
  "(": [[4.4, 0, 2.2, 2, 2.2, 7, 4.4, 9]],
  ")": [[1.6, 0, 3.8, 2, 3.8, 7, 1.6, 9]],
  "'": [[3.2, 0, 2.6, 2.4]],
  "!": [[3, 0, 3, 6.2], [3, 8.4, 3, 8.4]],
  "?": [[1.2, 2.4, 2, 0.6, 4, 0.6, 5.2, 1.8, 5, 3.4, 3.4, 4.6, 3, 5.8], [3, 8.4, 3, 8.4]],
  "+": [[3, 1.4, 3, 7.6], [0.6, 4.5, 5.4, 4.5]],
  "=": [[0.6, 3.2, 5.4, 3.2], [0.6, 6.2, 5.4, 6.2]],
};

const ADV = 7.4; // glyph advance, in font units

function textWidth(text: string, scale: number): number {
  let w = 0;
  for (const ch of text.toUpperCase()) w += ch === " " ? ADV * 0.75 : ADV;
  return w * scale;
}

function drawGlyph(ch: string, x: number, y: number, scale: number, c: RGB): void {
  const strokes = GLYPHS[ch];
  if (!strokes) return;
  const w = Math.max(1, Math.round(scale * 0.95));
  for (const s of strokes) {
    for (let i = 0; i + 3 < s.length; i += 2) {
      line(x + s[i] * scale, y + s[i + 1] * scale, x + s[i + 2] * scale, y + s[i + 3] * scale, w, c);
    }
    if (s.length === 2) disc(x + s[0] * scale, y + s[1] * scale, w / 2, c);
  }
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB, align: "left" | "center" | "right" = "left"): void {
  const t = text.toUpperCase();
  const w = textWidth(t, scale);
  let cx = x;
  if (align === "center") cx = x - w / 2;
  if (align === "right") cx = x - w;
  for (const ch of t) {
    if (ch !== " ") drawGlyph(ch, cx, y, scale, c);
    cx += (ch === " " ? ADV * 0.75 : ADV) * scale;
  }
}

// Greedy word wrap; returns lines that fit maxWidth.
function wrap(text: string, scale: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, scale) <= maxWidth || !cur) cur = trial;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function paragraph(text: string, x: number, y: number, scale: number, maxWidth: number, c: RGB, lineGap: number): number {
  const lines = wrap(text, scale, maxWidth);
  const lh = 9 * scale + lineGap;
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, scale, c));
  return y + lines.length * lh;
}

// ------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4;
      const di = y * (1 + W * 3) + 1 + x * 3;
      raw[di] = px[si];
      raw[di + 1] = px[si + 1];
      raw[di + 2] = px[si + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------- icons
// Small white line icons drawn inside a coloured band, 28x28 box at (x,y).
function iconShip(x: number, y: number, s: number): void {
  const u = s / 28;
  line(x + 2 * u, y + 20 * u, x + 26 * u, y + 20 * u, 2.4, WHITE);
  poly([x + 3 * u, y + 20 * u, x + 25 * u, y + 20 * u, x + 22 * u, y + 26 * u, x + 6 * u, y + 26 * u], WHITE);
  rect(x + 6 * u, y + 13 * u, 5 * u, 7 * u, WHITE);
  rect(x + 12 * u, y + 13 * u, 5 * u, 7 * u, WHITE);
  rect(x + 18 * u, y + 13 * u, 5 * u, 7 * u, WHITE);
  line(x + 8 * u, y + 13 * u, x + 8 * u, y + 5 * u, 2.2, WHITE);
  line(x + 8 * u, y + 5 * u, x + 13 * u, y + 8 * u, 2.2, WHITE);
}

function iconGlobe(x: number, y: number, s: number): void {
  const u = s / 28;
  circleOutline(x + 14 * u, y + 14 * u, 11 * u, 2.4, WHITE);
  line(x + 3 * u, y + 14 * u, x + 25 * u, y + 14 * u, 2, WHITE);
  // meridians as two arcs
  for (let a = -70; a <= 70; a += 6) {
    const r = (a * Math.PI) / 180;
    const px1 = x + 14 * u + Math.sin(r) * 6 * u;
    const py1 = y + 14 * u - Math.cos(r) * 11 * u;
    const px2 = x + 14 * u + Math.sin(r + 0.12) * 6 * u;
    const py2 = y + 14 * u - Math.cos(r + 0.12) * 11 * u;
    line(px1, py1, px2, py2, 1.8, WHITE);
  }
}

function iconDoc(x: number, y: number, s: number): void {
  const u = s / 28;
  poly([x + 7 * u, y + 3 * u, x + 19 * u, y + 3 * u, x + 23 * u, y + 7 * u, x + 23 * u, y + 25 * u, x + 7 * u, y + 25 * u], WHITE);
  line(x + 11 * u, y + 10 * u, x + 19 * u, y + 10 * u, 2, WHITE);
  line(x + 11 * u, y + 15 * u, x + 19 * u, y + 15 * u, 2, WHITE);
  line(x + 11 * u, y + 20 * u, x + 16 * u, y + 20 * u, 2, WHITE);
}

function iconPlane(x: number, y: number, s: number): void {
  const u = s / 28;
  poly([x + 2 * u, y + 15 * u, x + 12 * u, y + 12 * u, x + 24 * u, y + 4 * u, x + 26 * u, y + 6 * u, x + 16 * u, y + 15 * u, x + 22 * u, y + 20 * u, x + 19 * u, y + 21 * u, x + 13 * u, y + 17 * u, x + 8 * u, y + 22 * u, x + 6 * u, y + 20 * u, x + 9 * u, y + 16 * u], WHITE);
}

function iconTrophy(x: number, y: number, s: number): void {
  const u = s / 28;
  poly([x + 8 * u, y + 3 * u, x + 20 * u, y + 3 * u, x + 19 * u, y + 13 * u, x + 16 * u, y + 16 * u, x + 12 * u, y + 16 * u, x + 12 * u, y + 22 * u, x + 9 * u, y + 22 * u, x + 19 * u, y + 22 * u, x + 19 * u, y + 25 * u, x + 9 * u, y + 25 * u, x + 9 * u, y + 22 * u, x + 16 * u, y + 22 * u, x + 16 * u, y + 16 * u, x + 12 * u, y + 16 * u, x + 9 * u, y + 13 * u], WHITE);
  line(x + 8 * u, y + 5 * u, x + 4 * u, y + 7 * u, 2.2, WHITE);
  line(x + 20 * u, y + 5 * u, x + 24 * u, y + 7 * u, 2.2, WHITE);
}

function iconChart(x: number, y: number, s: number): void {
  const u = s / 28;
  rect(x + 4 * u, y + 16 * u, 4 * u, 9 * u, WHITE);
  rect(x + 12 * u, y + 11 * u, 4 * u, 14 * u, WHITE);
  rect(x + 20 * u, y + 6 * u, 4 * u, 19 * u, WHITE);
  line(x + 3 * u, y + 5 * u, x + 25 * u, y + 5 * u, 2, WHITE);
  line(x + 25 * u, y + 5 * u, x + 21 * u, y + 8 * u, 2, WHITE);
}

// ------------------------------------------------------- layout
const MX = 30; // page margin
const RX = W - MX; // right edge

function drawLeadGraphic(x: number, y: number, w: number, h: number): void {
  // Sky
  rect(x, y, w, h, SKY);
  // Sun
  disc(x + w - 52, y + 46, 22, YELLOW);
  // Explosion starburst above the ship
  const ex = x + w * 0.42;
  const ey = y + 62;
  const spikes: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 34 : 16;
    spikes.push(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
  }
  poly(spikes, ORANGE);
  const inner: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 === 0 ? 18 : 9;
    inner.push(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
  }
  poly(inner, YELLOW);
  // Smoke
  disc(ex - 46, ey + 26, 12, GREY);
  disc(ex - 30, ey + 12, 15, GREY);
  disc(ex + 52, ey + 20, 13, GREY);
  // Sea
  rect(x, y + h - 96, w, 96, SEA);
  line(x, y + h - 96, x + w, y + h - 96, 2, WHITE);
  for (let i = 0; i < 5; i++) {
    const wy = y + h - 72 + i * 16;
    for (let sx = 0; sx < w; sx += 8) {
      const yy = wy + Math.sin((sx / w) * Math.PI * 2 + i) * 3;
      setPx(x + sx, yy, WHITE);
      setPx(x + sx, yy + 1, WHITE);
    }
  }
  // Tanker
  const hx = x + 26;
  const hy = y + h - 118;
  poly([hx, hy, hx + w - 52, hy, hx + w - 78, hy + 34, hx + 18, hy + 34], INK);
  rect(hx + 30, hy - 26, 34, 26, RED);
  rect(hx + 70, hy - 26, 34, 26, GOLD);
  rect(hx + 110, hy - 26, 34, 26, TEAL);
  rect(hx + 150, hy - 26, 34, 26, RED);
  rect(hx + 196, hy - 40, 26, 40, WHITE);
  line(hx + 209, hy - 40, hx + 209, hy - 58, 3, INK);
  line(hx + 209, hy - 58, hx + 222, hy - 50, 3, RED);
  // label
  drawText("STRAIT OF HORMUZ", x + w / 2, y + h - 26, 2, WHITE, "center");
}

function drawCard(x: number, y: number, w: number, h: number, band: RGB, icon: (x: number, y: number, s: number) => void, tag: string, headline: string, body: string): void {
  // card paper + border
  rect(x, y, w, h, [255, 255, 255]);
  rect(x, y, w, 3, band);
  rect(x, y + h - 3, w, 3, band);
  rect(x, y, 3, h, band);
  rect(x + w - 3, y, 3, h, band);
  // coloured band with icon + tag
  rect(x + 3, y + 3, w - 6, 40, band);
  icon(x + 12, y + 9, 28);
  drawText(tag, x + 50, y + 15, 2.3, WHITE);
  // headline, placed by its own wrapped line count
  const headScale = 2.5;
  const headLines = wrap(headline, headScale, w - 32);
  const headLh = 9 * headScale + 5;
  headLines.forEach((ln, i) => drawText(ln, x + 16, y + 58 + i * headLh, headScale, INK));
  // body: only as many lines as fit above the bottom padding
  const bodyScale = 1.9;
  const bodyLh = 9 * bodyScale + 4;
  const bodyY = y + 58 + headLines.length * headLh + 10;
  const maxBodyLines = Math.max(0, Math.floor((y + h - 12 - bodyY) / bodyLh));
  const bodyLines = wrap(body, bodyScale, w - 32).slice(0, maxBodyLines);
  bodyLines.forEach((ln, i) => drawText(ln, x + 16, bodyY + i * bodyLh, bodyScale, GREY));
}

function main(): void {
  fillAll(PAPER);

  // ---- masthead
  rect(MX, 30, RX - MX, 116, INK);
  rect(MX, 146, RX - MX, 6, RED);
  drawText("WORLD NEWS", MX + 22, 52, 6.4, WHITE);
  drawText("MONDAY", RX - 22, 48, 2.6, GOLD, "right");
  drawText("23 NOVEMBER 2026", RX - 22, 78, 3.1, WHITE, "right");
  drawText("THE DAY IN ONE IMAGE", RX - 22, 112, 1.9, [190, 200, 220], "right");

  // ---- lead story
  const LY = 176;
  drawText("TOP STORY  -  MIDDLE EAST", MX, LY, 2.2, RED);
  drawText("IRAN WAR WIDENS", MX, LY + 30, 5.4, INK);
  const subEnd = paragraph(
    "TANKERS ATTACKED IN THE STRAIT OF HORMUZ; IRAN HITS BAHRAIN AS A U.S. BLOCKADE LOOMS",
    MX, LY + 96, 2.6, 610, INK, 5,
  );
  drawText("AT LEAST THREE OIL TANKERS HIT;", MX, subEnd + 16, 2, GREY);
  drawText("TWO PEOPLE HURT IN THE BAHRAIN STRIKE.", MX, subEnd + 16 + 26, 2, GREY);
  drawText("TRUMP: TEHRAN WANTS A DEAL,", MX, subEnd + 16 + 52, 2, GREY);
  drawText("BUT NOT ONE HE CALLS ACCEPTABLE.", MX, subEnd + 16 + 78, 2, GREY);
  drawLeadGraphic(668, LY, 326, 288);

  // ---- divider
  rect(MX, 486, RX - MX, 3, INK);

  // ---- story cards, 3 x 2
  const cw = 310;
  const ch = 224;
  const gx = [MX, MX + cw + 17, MX + 2 * (cw + 17)];
  const gy = [502, 742];
  drawCard(gx[0], gy[0], cw, ch, INK, iconShip, "UKRAINE", "RUSSIAN SHIP SUNK OFF LIBYA", "Sea drones sink corvette Merkury off Libya. Strike kills 15 near Kyiv.");
  drawCard(gx[1], gy[0], cw, ch, TEAL, iconGlobe, "CLIMATE", "COP31 ENDS WITH NO DEAL", "The longest climate summit ever fails over fossil fuels and money.");
  drawCard(gx[2], gy[0], cw, ch, RED, iconDoc, "GAZA", "99% OF GAZA LEFT TOXIC", "War contamination spans Gaza, a report says. Settler arson condemned.");
  drawCard(gx[0], gy[1], cw, ch, BLUE, iconPlane, "AMERICA", "1,600 FLIGHTS DELAYED", "Thanksgiving travel chaos. Trump ends the penny after 232 years.");
  drawCard(gx[1], gy[1], cw, ch, GREEN, iconTrophy, "SPORT", "ALCARAZ WINS ATP FINALS", "Beats Zverev in straight sets for his first Masters Cup title.");
  drawCard(gx[2], gy[1], cw, ch, [146, 110, 16], iconChart, "MARKETS", "STOCKS SLIDE ON AI FEARS", "Indexes fall as investors question whether the AI boom can last.");

  // ---- footer
  drawText("MONDAY 23 NOVEMBER 2026  -  THE WORLD'S NEWS IN ONE IMAGE", W / 2, 982, 1.9, GREY, "center");

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/entry.png`, encodePNG());
}

main();
