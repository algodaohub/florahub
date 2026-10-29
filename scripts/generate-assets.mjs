import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'public', 'images')
await mkdir(outDir, { recursive: true })

const palettes = [
  ['#C64B5A', '#E88A94', '#F6D9DC', '#3F6B4F'],
  ['#E7A3B4', '#F4C8D2', '#FBE8EC', '#5B7A5E'],
  ['#F5F2E8', '#E6DFC9', '#C9BE9A', '#6D7F5A'],
  ['#E8B93F', '#F3D77B', '#FBF0C9', '#55734F'],
  ['#F7F6F1', '#DDE5D8', '#BFD0B8', '#4C6B50'],
  ['#E9A8BC', '#F5CBD6', '#FCE9EE', '#4C6B50'],
  ['#B7323F', '#D9646C', '#F2C6C4', '#3F6B4F'],
  ['#E9B7C6', '#F4D2DC', '#FBE9EE', '#5B7A5E'],
  ['#F7F5EF', '#E8E2D2', '#CFC6AE', '#4C6B50'],
  ['#8E6BA8', '#B99BCB', '#E6D8EE', '#4C6B50'],
  ['#6E8C62', '#A3B99A', '#DCE6D7', '#3F6B4F'],
  ['#C99A6B', '#E5C5A3', '#F5E6D5', '#5B7A5E']
]

function flowerSvg({ petal, petalSoft, bg, stem, seed = 1, petals = 7 }) {
  const cx = 400
  const cy = 380
  const r = 92
  let shapes = ''
  for (let i = 0; i < petals; i += 1) {
    const angle = (360 / petals) * i + seed * 5
    shapes += `<ellipse cx="${cx}" cy="${cy - r * 0.62}" rx="${r * 0.42}" ry="${r * 0.78}" fill="url(#petal)" opacity="0.95" transform="rotate(${angle} ${cx} ${cy})"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img">
  <defs>
    <radialGradient id="petal" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${petalSoft}"/>
      <stop offset="65%" stop-color="${petal}"/>
      <stop offset="100%" stop-color="${petalSoft}"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFDF9"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.035"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="640" cy="160" r="150" fill="${petalSoft}" opacity="0.35"/>
  <circle cx="120" cy="640" r="190" fill="${petalSoft}" opacity="0.25"/>
  <path d="M400 430 C398 520 392 600 384 690" stroke="${stem}" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M398 545 C340 520 300 540 270 585 C320 596 368 580 398 545Z" fill="${stem}" opacity="0.85"/>
  <path d="M392 600 C448 572 492 588 520 632 C470 646 424 632 392 600Z" fill="${stem}" opacity="0.7"/>
  <g>${shapes}</g>
  <circle cx="${cx}" cy="${cy}" r="30" fill="${stem}" opacity="0.9"/>
  <circle cx="${cx - 8}" cy="${cy - 8}" r="10" fill="#F5D98A" opacity="0.8"/>
  <rect width="800" height="800" filter="url(#grain)" opacity="0.6"/>
</svg>`
}

function bannerSvg({ base, soft, accent, seed = 0 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 620" role="img">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${soft}"/>
      <stop offset="100%" stop-color="${base}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="620" fill="url(#b)"/>
  <circle cx="930" cy="310" r="250" fill="url(#glow)"/>
  <g opacity="0.9" transform="translate(860 300)">
    ${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-96" rx="52" ry="108" fill="${accent}" opacity="${0.5 + i * 0.04}" transform="rotate(${i * 45})"/>`).join('')}
    <circle r="34" fill="#F5D98A"/>
  </g>
  <g opacity="0.55" transform="translate(1080 470) scale(0.55)">
    ${Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-96" rx="52" ry="108" fill="${accent}" transform="rotate(${i * 45 + 12})"/>`).join('')}
    <circle r="34" fill="#F5D98A"/>
  </g>
  <rect width="1200" height="620" fill="${base}" opacity="${0.05 + seed * 0.01}"/>
</svg>`
}

const products = palettes.map((p, i) =>
  flowerSvg({ petal: p[0], petalSoft: p[1], bg: p[2], stem: p[3], seed: i + 1, petals: 6 + (i % 3) })
)

await writeFile(join(outDir, 'hero-1.svg'), bannerSvg({ base: '#DCE7D9', soft: '#F6F2E7', accent: '#C64B5A', seed: 1 }))
await writeFile(join(outDir, 'hero-2.svg'), bannerSvg({ base: '#F0DDD2', soft: '#FBF4EA', accent: '#E7A3B4', seed: 2 }))

const categories = ['hoa-hong', 'hoa-cuc', 'baby', 'tulip', 'lan-ho-diep', 'phu-kien']
for (const [i, slug] of categories.entries()) {
  await writeFile(join(outDir, `category-${slug}.svg`), products[i])
}

for (const [i, svg] of products.entries()) {
  await writeFile(join(outDir, `product-${i + 1}.svg`), svg)
}

for (let i = 1; i <= 3; i += 1) {
  await writeFile(join(outDir, `post-${i}.svg`), products[(i + 8) % products.length])
}

console.log(`Generated ${products.length} product images, ${categories.length} categories, 2 banners, 3 posts in ${outDir}`)
