#!/usr/bin/env node
/**
 * Render Google Play Store listing assets from their canonical SVG sources.
 *
 * The SVGs in ./store are the source of truth; the PNGs are build output. Edit
 * the SVG, then run this script (or `npm run store:render`) to regenerate the
 * PNGs so they stay in sync.
 *
 * Requires: `sharp` (already a dev dependency). No ImageMagick/rsvg needed.
 *
 * Usage:
 *   node scripts/render-store-assets.mjs
 *   npm run store:render
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// [canonical svg, output png]. Output size is taken from the SVG's own width/height.
const ASSETS = [
  ['store/feature-graphic.svg', 'store/feature-graphic.png'],
]

async function renderAsset(svgRel, pngRel) {
  const svgPath = resolve(ROOT, svgRel)
  const pngPath = resolve(ROOT, pngRel)
  const svg = readFileSync(svgPath, 'utf8')

  // Resolve the PNG size from the SVG root width/height so it always matches.
  const root = svg.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/)
  if (!root) throw new Error(`Cannot read width/height from ${svgRel}`)
  const width = parseInt(root[1], 10)
  const height = parseInt(root[2], 10)

  const buf = await sharp(Buffer.from(svg), { density: 72 }).resize(width, height).png().toBuffer()
  const meta = await sharp(buf).metadata()

  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${pngRel} rendered at ${meta.width}x${meta.height}, expected ${width}x${height}`)
  }

  writeFileSync(pngPath, buf)
  console.log(`[store:render] ${pngRel}  ${meta.width}x${meta.height}  ${buf.length} bytes`)
}

for (const [svg, png] of ASSETS) {
  try {
    await renderAsset(svg, png)
  } catch (err) {
    console.error(`[store:render] FAILED ${png}:`, err.message)
    process.exitCode = 1
  }
}
