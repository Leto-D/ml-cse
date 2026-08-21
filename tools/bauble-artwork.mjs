#!/usr/bin/env node
/**
 * Convertit les tracés vectoriels d'Alsace Lait en données prêtes pour la scène.
 *
 *   svg/Alsace lait face avant.svg    →  plaque avant
 *   svg/Alsace lait face arrière.svg  →  plaque arrière
 *
 * Produit deux fichiers, et deux seulement :
 *   src/components/bauble/artwork.gen.ts  polygones, pour la géométrie 3D ;
 *   src/components/bauble/poster.gen.ts   tracés SVG, pour le repli statique.
 *
 * Les deux sont séparés exprès. Le repli est lu par un fichier `.astro`, donc
 * au build : ses chaînes n'atteignent jamais le navigateur. Les mettre dans le
 * même module que les polygones les ferait voyager dans le morceau three.
 *
 * ── Ce que dit le dessin ──────────────────────────────────────────────────
 * Les fichiers d'origine sont du trait pur : ni remplissage, ni couleur, ni
 * indication de ce qui traverse la plaque. La lecture est établie ici, une
 * fois, et vérifiée par les assertions plus bas :
 *
 *   AVANT   la silhouette, l'œillet, la fenêtre du ciel et les dix lettres
 *           d'ALSACE LAIT traversent. La coiffe, la feuille, la collerette et
 *           le visage sont GRAVÉS : le calcul § « fenêtre » montre qu'aucun de
 *           leurs points ne tombe dans le vide — le tracé de la fenêtre épouse
 *           la coiffe au trait près, ce qui ne peut pas être un hasard.
 *   ARRIÈRE tout traverse : silhouette, œillet, ciel autour des sapins,
 *           maisons, portes et fenêtres rondes.
 *
 * ── Le médaillon se lit en aplats ─────────────────────────────────────────
 * Et surtout pas au trait. Rendre ces contours au filet donne un masque : deux
 * yeux et une bouche cernés, flottant sur du bois. Le logo imprimé, lui, est
 * fait de masses — une coiffe pleine, un visage clair, des traits sombres —, et
 * le fichier le dit si on le remplit : `MEDALLION` ci-dessous nomme les couches
 * et leur teinte, dans l'ordre où elles se peignent.
 *
 * Le visage est dessiné en NÉGATIF dans le fichier : l'élément 3 rempli donne
 * une tête sombre aux yeux clairs. On le repeint donc à l'endroit — la tête en
 * bois nu, les traits en brûlé —, ce qui rend exactement le logo.
 *
 * ── Repère ────────────────────────────────────────────────────────────────
 * Rayon du corps = 1, origine au centre du corps, y vers le haut. Les deux
 * fichiers donnent exactement la même silhouette (2,000 × 2,306) : c'est
 * vérifié, et c'est ce qui autorise `FRAME` à rester une constante.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elements, subpaths, bbox, signedArea, inside, mul } from './svgpath.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── Réglages ─────────────────────────────────────────────────────────────── */

/**
 * Flèche maximale tolérée en subdivisant les courbes, en rayons de corps.
 * 0,0012 ≈ un tiers de pixel quand la boule occupe la hauteur d'un écran.
 */
const TOL_3D = 0.0012;
/**
 * Deux sommets plus proches que ça sont fondus. Une arête de longueur nulle
 * donne une oreille dégénérée à la triangulation puis une normale non unitaire
 * à l'extrusion : c'est exactement la famille de défauts qu'on a chassée.
 */
const MIN_SEG = 0.0025;
/**
 * Le repli est un poster de quelques centaines de pixels : il peut être bien
 * plus grossier. On ne relit pas les fichiers pour autant — on simplifie les
 * mêmes anneaux, avec une tolérance proportionnelle à la taille de CHACUN.
 * Une tolérance unique effacerait le contre-poinçon d'un A en même temps
 * qu'elle arrondirait la silhouette.
 */
const POSTER_EPS = { min: 0.0015, max: 0.008, ratio: 0.02 };

/**
 * Ligne de partage entre le lettrage — qui traverse — et le dessin du logo —
 * qui est gravé. Le sommet de la lettre la plus haute est à −0,493 ; le point
 * le plus bas de la coiffe à −0,461. La bande est franche, on se place au
 * milieu.
 */
const LETTER_TOP = -0.477;

/**
 * Les couches du médaillon, peintes dans cet ordre. `element` désigne l'ordre
 * d'apparition dans le fichier source ; `depth` restreint aux anneaux d'une
 * profondeur d'imbrication donnée à l'intérieur de leur élément.
 *
 * Le remplissage est pair-impair : à l'intérieur d'une même couche, un anneau
 * imbriqué creuse celui qui le contient. La feuille et la collerette sont donc
 * des vides de la coiffe sans qu'on ait à les nommer.
 */
const MEDALLION = [
  /** La coiffe : un aplat brûlé, et ses évidements clairs. */
  { element: 2, tone: 'burn' },
  /** Les plis de la coiffe, clairs comme sur le logo imprimé. */
  { element: 1, tone: 'wood' },
  /** Le visage, en bois nu. */
  { element: 3, depth: 1, tone: 'wood' },
  /**
   * Ses traits. Il faut les peindre : les laisser en creux du visage les
   * rendrait de la couleur de ce qu'il y a dessous, et sous le menton ce n'est
   * pas la coiffe mais du bois nu — la bouche disparaîtrait.
   */
  { element: 3, depth: 2, tone: 'burn' },
];

/** Rayon du corps dans le repère du poster, et centre dans sa boîte. */
const POSTER = { R: 84, CX: 100, CY: 145, W: 200, H: 254 };

/* ── Lecture ──────────────────────────────────────────────────────────────── */

/** Anneaux d'un fichier, normalisés en rayons de corps. */
function read(file, tol, minSeg) {
  const svg = readFileSync(join(ROOT, 'svg', file), 'utf8');
  const els = elements(svg);

  // Passe grossière, en unités du fichier : le plus grand anneau est la
  // silhouette, et sa boîte donne l'échelle. Le corps est le point le plus
  // large ET le plus bas, donc R = largeur/2 et le centre s'en déduit.
  const coarse = els.flatMap((e) => subpaths(e.d, e.m, 0.05, 0.05));
  const big = coarse.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
  const B = bbox(big);
  const R = B.w / 2;
  const N = [1 / R, 0, 0, -1 / R, -B.cx / R, (B.y1 - R) / R];

  const rings = [];
  for (const [ei, e] of els.entries()) {
    for (const r of subpaths(e.d, mul(N, e.m), tol, minSeg)) {
      const b = bbox(r);
      // Le fichier avant porte deux doublons exacts (l'œillet, la lettre C) :
      // l'exportateur a dupliqué les tracés partagés entre calques.
      const twin = rings.find(
        (o) => Math.abs(o.b.cx - b.cx) < 1e-3 && Math.abs(o.b.cy - b.cy) < 1e-3 &&
               Math.abs(o.b.w - b.w) < 1e-3 && Math.abs(o.b.h - b.h) < 1e-3,
      );
      if (!twin) rings.push({ ei, r, b, a: signedArea(r) });
    }
  }
  return { rings, box: bbox(rings.reduce((a, x) => (Math.abs(x.a) > Math.abs(a.a) ? x : a)).r) };
}

/**
 * Profondeur d'imbrication de chaque anneau. 1 = la silhouette, 2 = un vide,
 * 3 = un îlot de matière au milieu d'un vide. Au-delà, on refuse : `Shape` de
 * three ne sait pas percer un trou dans un trou.
 */
function nest(rings) {
  return rings.map((x, i) => {
    let depth = 1;
    for (const [j, o] of rings.entries()) {
      if (i === j || Math.abs(o.a) <= Math.abs(x.a)) continue;
      if (inside(o.r, x.r[0][0], x.r[0][1])) depth++;
    }
    return depth;
  });
}

/** Sens direct pour la matière, indirect pour les vides. */
function wind(r, ccw) {
  // `signedArea` est positive dans le sens direct, y vers le haut.
  return signedArea(r) > 0 === ccw ? r : [...r].reverse();
}

const round = (r, dp) => r.flatMap(([x, y]) => [+x.toFixed(dp), +y.toFixed(dp)]);

/* ── Simplification ───────────────────────────────────────────────────────── */

/** Douglas–Peucker, sur un anneau fermé. */
function simplify(ring, eps) {
  const d2 = (p, a, b) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const L = dx * dx + dy * dy;
    let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2;
  };
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let worst = -1;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = d2(ring[k], ring[i], ring[j]);
      if (d > worst) { worst = d; at = k; }
    }
    if (worst > eps * eps) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 3 ? out : ring;
}

/** Tolérance de simplification d'un anneau, proportionnée à son encombrement. */
function posterEps(ring) {
  const b = bbox(ring);
  const diag = Math.hypot(b.w, b.h);
  return Math.max(POSTER_EPS.min, Math.min(POSTER_EPS.max, diag * POSTER_EPS.ratio));
}

/* ── Classement ───────────────────────────────────────────────────────────── */

/**
 * Répartit les anneaux d'une plaque en quatre paquets.
 *
 * Deux vides sont STRUCTURELS et se reconnaissent seuls : la fenêtre du ciel
 * est le plus grand vide de la plaque, l'œillet est le seul qui soit percé
 * dans la patte, donc au-dessus du corps. Tous les autres sont départagés par
 * `engraveAbove` : sous cette ordonnée on découpe — c'est le lettrage —,
 * au-dessus on grave — c'est le dessin du logo. `null` = tout traverse.
 */
function classify(rings, depths, engraveAbove) {
  const out = { outline: null, holes: [], islands: [], engraving: [] };

  const voids = rings.filter((_, i) => depths[i] === 2);
  const window = voids.reduce((a, b) => (Math.abs(b.a) > Math.abs(a.a) ? b : a), voids[0]);
  const structural = new Set([window, ...voids.filter((x) => x.b.y0 >= 1)]);

  const engraved = [];
  rings.forEach((x, i) => {
    const d = depths[i];
    if (d === 1) {
      if (out.outline) throw new Error('deux contours extérieurs');
      out.outline = wind(x.r, true);
    } else if (engraveAbove !== null && !structural.has(x) && x.b.y1 > engraveAbove) {
      engraved.push(x);
    } else if (d === 2) {
      out.holes.push(wind(x.r, false));
    } else if (d === 3) {
      out.islands.push(wind(x.r, true));
    } else {
      throw new Error(`imbrication de profondeur ${d} : un trou dans un trou`);
    }
  });

  // Imbrication LOCALE, à l'intérieur d'un même élément : c'est elle que le
  // pair-impair de SVG applique, et c'est donc elle que `MEDALLION` désigne.
  const localDepth = (x) =>
    1 + engraved.filter(
      (o) => o !== x && o.ei === x.ei && Math.abs(o.a) > Math.abs(x.a) &&
             inside(o.r, x.r[0][0], x.r[0][1]),
    ).length;

  out.engraving = MEDALLION.map((spec) => ({
    tone: spec.tone,
    rings: engraved
      .filter((x) => x.ei === spec.element && (spec.depth === undefined || localDepth(x) === spec.depth))
      .map((x) => x.r),
  })).filter((layer) => layer.rings.length > 0);

  const placed = out.engraving.reduce((n, l) => n + l.rings.length, 0);
  if (placed !== engraved.length) {
    throw new Error(`${engraved.length - placed} anneaux gravés qu'aucune couche ne réclame`);
  }
  return out;
}

/* ── Émission ─────────────────────────────────────────────────────────────── */

const fmt = (rings, dp) => rings.map((r) => `    [${round(r, dp).join(',')}],`).join('\n');

/** Anneaux → un seul attribut `d`, à remplir en `evenodd`. */
function toPath(rings, dp) {
  const s = (v) => +v.toFixed(dp);
  return rings
    .map((r) => `M${s(r[0][0])} ${s(r[0][1])}` + r.slice(1).map(([x, y]) => `L${s(x)} ${s(y)}`).join('') + 'Z')
    .join('');
}

/** Repère monde → repère du poster. */
const toPoster = (r) =>
  r.map(([x, y]) => [POSTER.CX + x * POSTER.R, POSTER.CY - y * POSTER.R]);

/* ── Programme ────────────────────────────────────────────────────────────── */

const PLATES = [
  { key: 'front', file: 'Alsace lait face avant.svg', engraveAbove: LETTER_TOP,
    expect: { holes: 12, islands: 3, layers: 4, engravedRings: 38 } },
  { key: 'back', file: 'Alsace lait face arrière.svg', engraveAbove: null,
    expect: { holes: 13, islands: 0, layers: 0, engravedRings: 0 } },
];

const art = {};
const poster = {};
let box = null;

for (const p of PLATES) {
  const { rings, box: b } = read(p.file, TOL_3D, MIN_SEG);
  const c = classify(rings, nest(rings), p.engraveAbove);
  art[p.key] = c;

  const pts = (x) => x.reduce((n, r) => n + r.length, 0);
  const engravedRings = c.engraving.reduce((n, l) => n + l.rings.length, 0);
  console.log(
    `${p.key.padEnd(6)} ${p.file}\n` +
    `  contour ${String(c.outline.length).padStart(4)} pts` +
    `   vides ${String(c.holes.length).padStart(2)} (${pts(c.holes)} pts)` +
    `   îlots ${String(c.islands.length).padStart(2)} (${pts(c.islands)} pts)\n` +
    `  gravure ${c.engraving.length} couches, ${engravedRings} anneaux` +
    c.engraving.map((l) => ` [${l.tone} ${l.rings.length}]`).join('') + '\n' +
    `  boîte ${b.w.toFixed(4)} × ${b.h.toFixed(4)}   y ∈ [${b.y0.toFixed(4)}, ${b.y1.toFixed(4)}]`,
  );

  // Une régression silencieuse du classement donnerait un objet plausible mais
  // faux : on la fait échouer ici plutôt qu'à l'écran.
  const counted = {
    holes: c.holes.length,
    islands: c.islands.length,
    layers: c.engraving.length,
    engravedRings,
  };
  for (const [k, n] of Object.entries(p.expect)) {
    if (counted[k] !== n) throw new Error(`${p.key} : ${counted[k]} ${k}, ${n} attendus`);
  }

  if (!box) box = b;
  else if (Math.abs(box.w - b.w) > 1e-3 || Math.abs(box.y0 - b.y0) > 1e-3 || Math.abs(box.y1 - b.y1) > 1e-3) {
    throw new Error('les deux plaques n\'ont pas la même silhouette');
  }

  const thin = (rings) => rings.map((r) => toPoster(simplify(r, posterEps(r))));
  poster[p.key] = {
    cut: toPath(thin([c.outline, ...c.holes, ...c.islands]), 1),
    medallion: c.engraving.map((l) => ({ tone: l.tone, d: toPath(thin(l.rings), 1) })),
  };
}

const head = (what) => `/**
 * ${what}
 *
 * FICHIER GÉNÉRÉ — ne pas modifier à la main.
 * Source   : svg/Alsace lait face avant.svg, svg/Alsace lait face arrière.svg
 * Commande : npm run artwork   (tools/bauble-artwork.mjs)
 */
`;

const plate = (c) => `  {
  outline: [${round(c.outline, 4).join(',')}],
  holes: [
${fmt(c.holes, 4)}
  ],
  islands: [
${fmt(c.islands, 4)}
  ],
  engraving: [
${c.engraving.map((l) => `    { tone: '${l.tone}', rings: [\n${fmt(l.rings, 3)}\n    ] },`).join('\n')}
  ],
  }`;

writeFileSync(
  join(ROOT, 'src/components/bauble/artwork.gen.ts'),
  head('Tracés de la boule Alsace Lait, en rayons de corps.') +
    `import type { BaubleArtwork } from './artwork';\n\n` +
    `/** Boîte englobante de la silhouette. Les deux plaques ont la même. */\n` +
    `export const SILHOUETTE_BOX = { top: ${box.y1.toFixed(4)}, bottom: ${box.y0.toFixed(4)} };\n\n` +
    `export const ALSACE_LAIT: BaubleArtwork = {\n` +
    `  front:\n${plate(art.front)},\n` +
    `  back:\n${plate(art.back)},\n};\n`,
);

writeFileSync(
  join(ROOT, 'src/components/bauble/poster.gen.ts'),
  head('Mêmes tracés, simplifiés, pour le repli statique de la section.') +
    `export const POSTER = {\n` +
    `  /** Rayon du corps, centre et boîte dans le repère de ces tracés. */\n` +
    `  R: ${POSTER.R}, CX: ${POSTER.CX}, CY: ${POSTER.CY}, W: ${POSTER.W}, H: ${POSTER.H},\n` +
    `  front: {\n    cut:\n      '${poster.front.cut}',\n    medallion: [\n` +
    poster.front.medallion.map((l) => `      { tone: '${l.tone}', d:\n        '${l.d}' },\n`).join('') +
    `    ],\n  },\n` +
    `  back: {\n    cut:\n      '${poster.back.cut}',\n  },\n} as const;\n`,
);

const kb = (f) => (readFileSync(join(ROOT, f)).length / 1024).toFixed(1);
console.log(`\nartwork.gen.ts ${kb('src/components/bauble/artwork.gen.ts')} Ko`);
console.log(`poster.gen.ts  ${kb('src/components/bauble/poster.gen.ts')} Ko`);
