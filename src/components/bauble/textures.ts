/**
 * Textures de la boule, composées au canevas à l'exécution.
 *
 * Rien n'est chargé depuis le disque : le bois, les gravures et le halo sont
 * dessinés en JavaScript. Trois conséquences voulues :
 *
 * 1. zéro octet d'image dans le bundle ;
 * 2. aucun chemin absolu, donc le piège du sous-chemin `/ml-cse` est contourné
 *    par construction (voir CONTEXTE-TECHNIQUE, § « Le piège du chemin de base ») ;
 * 3. le logo et le nom de l'entreprise ne sont JAMAIS cuits dans la texture de
 *    base : ils sont deux couches peintes par-dessus, à la toute fin. Recomposer
 *    pour un configurateur = rappeler la fonction et poser `needsUpdate`.
 *
 * Trois faces seulement portent un dessin, et c'est la mécanique de l'objet qui
 * le dicte :
 *   — la DÉCOUPE (les deux faces de la plaque avant) est du bois nu. Son décor
 *     est de la matière retirée, il est dans la géométrie, pas dans la texture ;
 *   — le FOND RECTO est le bois sombre qu'on aperçoit à travers les ajours,
 *     avec le logo posé dans l'ouverture centrale ;
 *   — le FOND VERSO porte le bloc gravé — mention d'origine et nom — que le
 *     retournement révèle en fin de course.
 *
 * Les visuels sont des PLACEHOLDERS et le disent : hachures diagonales et
 * mention « PLACEHOLDER » incrustées. Aucun risque de les confondre avec un
 * rendu final.
 *
 * Le repère est celui de `shape.ts` : un carré de côté 2 × FRAME.HALF centré
 * sur la boîte englobante de la silhouette. Les deux fichiers DOIVENT lire les
 * mêmes constantes, sinon le décor glisse par rapport à la découpe.
 */
import type { DecorId } from '~/types';
import { FRAME, LAYOUT } from './shape';

export interface WoodPalette {
  /** Veine claire du bois. */
  light: string;
  /** Ton moyen, couleur dominante de la planche. */
  mid: string;
  /** Veine sombre. */
  dark: string;
  /** Fond de gravure : le bois brûlé par la fraise. */
  burn: string;
  /** Lèvre claire au-dessus de la gravure, qui crée le relief. */
  lip: string;
  /** Touche métallique (œillet de suspension). */
  gold: string;
}

/* ------------------------------------------------------------------ *
 * Repère : monde → pixels de texture
 * ------------------------------------------------------------------ */
const SPAN = 2 * FRAME.HALF;
/** Abscisse monde → pixel. */
const px = (x: number, size: number) => ((x + FRAME.HALF) / SPAN) * size;
/** Ordonnée monde (vers le haut) → pixel canevas (vers le bas). */
const py = (y: number, size: number) => ((FRAME.HALF - (y - FRAME.CY)) / SPAN) * size;
/** Longueur monde → longueur en pixels. */
const pu = (l: number, size: number) => (l / SPAN) * size;

/* ------------------------------------------------------------------ *
 * Aléatoire déterministe
 * Un `Math.random()` donnerait un veinage différent à chaque rechargement,
 * et deux faces qui ne se correspondent pas d'un rendu à l'autre.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasOf(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponible');
  return [c, ctx];
}

/** Le fond est plus sombre que la découpe : c'est ce contraste qui creuse. */
const deepen = (p: WoodPalette): WoodPalette => ({
  ...p,
  light: p.mid,
  mid: p.dark,
  dark: '#7B5836',
});

/** Le verso a moins vu le jour : légèrement plus clair et plus uni. */
const backside = (p: WoodPalette): WoodPalette => ({
  ...p,
  light: '#F1DEC0',
  mid: p.light,
});

/* ------------------------------------------------------------------ *
 * Bois
 * ------------------------------------------------------------------ */
function drawWood(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: WoodPalette,
  seed: number,
) {
  ctx.fillStyle = p.mid;
  ctx.fillRect(0, 0, size, size);

  const rnd = mulberry32(seed);

  // Veinage : des ondulations verticales de largeur et d'opacité variables.
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const amp = 4 + rnd() * 26;
    const phase = rnd() * Math.PI * 2;
    const period = 180 + rnd() * 420;
    ctx.beginPath();
    for (let y = -10; y <= size + 10; y += 12) {
      const dx = Math.sin(phase + y / period) * amp;
      if (y < 0) ctx.moveTo(x + dx, y);
      else ctx.lineTo(x + dx, y);
    }
    ctx.strokeStyle = rnd() > 0.5 ? p.dark : p.light;
    ctx.globalAlpha = 0.05 + rnd() * 0.1;
    ctx.lineWidth = 0.6 + rnd() * 3.2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Deux ou trois nœuds, sinon la planche paraît imprimée.
  for (let k = 0; k < 3; k++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const rx = 10 + rnd() * 16;
    for (let r = 1; r <= 6; r++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * r * 0.5, rx * r * 0.34, rnd() * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = p.dark;
      ctx.globalAlpha = 0.1 - r * 0.012;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Assombrissement du pourtour : la plaque paraît légèrement bombée.
  const vig = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.3,
    size / 2, size / 2, size * 0.54,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);
}

/* ------------------------------------------------------------------ *
 * Gravure
 * Le relief vient de copies décalées, comme sur la page « Votre logo » :
 * une lèvre claire posée AU-DESSUS du tracé, puis le fond brûlé par-dessus.
 * Seule la frange qui dépasse reste visible, et c'est elle qui fait le creux.
 * ------------------------------------------------------------------ */
function engrave(
  ctx: CanvasRenderingContext2D,
  p: WoodPalette,
  depth: number,
  shape: (c: CanvasRenderingContext2D) => void,
) {
  ctx.save();
  ctx.translate(0, -depth);
  ctx.fillStyle = p.lip;
  ctx.globalAlpha = 0.55;
  shape(ctx);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = p.burn;
  ctx.globalAlpha = 0.82;
  shape(ctx);
  ctx.restore();
}

const depthOf = (size: number) => Math.max(1.5, size * 0.0026);

/* ------------------------------------------------------------------ *
 * Motifs
 * ------------------------------------------------------------------ */
function starPath(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const dx = x + Math.cos(a) * rad;
    const dy = y + Math.sin(a) * rad;
    if (i === 0) c.moveTo(dx, dy);
    else c.lineTo(dx, dy);
  }
  c.closePath();
  c.fill();
}

function firPath(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let tier = 0; tier < 3; tier++) {
    const w = r * (0.5 + tier * 0.26);
    const top = y - r + tier * r * 0.52;
    c.moveTo(x, top);
    c.lineTo(x + w, top + r * 0.62);
    c.lineTo(x - w, top + r * 0.62);
    c.closePath();
  }
  c.rect(x - r * 0.12, y + r * 0.5, r * 0.24, r * 0.34);
  c.fill();
}

function flakePath(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    c.moveTo(-ux * r * 0.08, -uy * r * 0.08);
    c.lineTo(ux * r, uy * r);
    // Deux barbes par branche.
    for (const t of [0.5, 0.78]) {
      const bx = ux * r * t;
      const by = uy * r * t;
      const nx = -uy * r * 0.22;
      const ny = ux * r * 0.22;
      c.moveTo(bx, by);
      c.lineTo(bx + nx * 0.8 + ux * r * 0.14, by + ny * 0.8 + uy * r * 0.14);
      c.moveTo(bx, by);
      c.lineTo(bx - nx * 0.8 + ux * r * 0.14, by - ny * 0.8 + uy * r * 0.14);
    }
  }
  c.lineWidth = Math.max(1.6, r * 0.1);
  c.lineCap = 'round';
  c.strokeStyle = c.fillStyle;
  c.stroke();
  c.restore();
}

function motif(
  c: CanvasRenderingContext2D,
  decor: DecorId,
  x: number,
  y: number,
  r: number,
  rot: number,
) {
  if (decor === 'etoiles') starPath(c, x, y, r, rot);
  else if (decor === 'sapins') firPath(c, x, y, r);
  else flakePath(c, x, y, r, rot);
}

/* ------------------------------------------------------------------ *
 * Filet gravé, posé entre les ajours et le bord : il ne croise jamais la
 * découpe (les ajours s'arrêtent à LAYOUT.FIELD, le corps va jusqu'à 1).
 * ------------------------------------------------------------------ */
function drawFillet(ctx: CanvasRenderingContext2D, size: number, p: WoodPalette) {
  const cx = px(0, size);
  const cy = py(0, size);
  const ring = (r: number, w: number) =>
    engrave(ctx, p, depthOf(size) * 0.8, (c) => {
      c.beginPath();
      c.arc(cx, cy, pu(r + w / 2, size), 0, Math.PI * 2);
      c.arc(cx, cy, pu(r - w / 2, size), 0, Math.PI * 2, true);
      c.fill('evenodd');
    });
  ring(0.93, 0.012);
  ring(0.905, 0.006);
}

/* ------------------------------------------------------------------ *
 * Couche logo — jamais cuite dans le décor
 * ------------------------------------------------------------------ */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  size: number,
  logo: HTMLImageElement | null,
  p: WoodPalette,
  worldX: number,
  worldY: number,
  worldBox: number,
) {
  const box = pu(worldBox, size);
  const cx = px(worldX, size);
  const cy = py(worldY, size);
  const d = depthOf(size);

  if (logo && logo.naturalWidth > 0) {
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;

    // Le logo est gravé, pas collé : il passe en niveaux de gris brûlés.
    const [tmp, tctx] = canvasOf(Math.max(2, Math.round(box)));
    tctx.drawImage(logo, 0, 0, tmp.width, tmp.height);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = p.burn;
    tctx.fillRect(0, 0, tmp.width, tmp.height);

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(tmp, cx - w / 2, cy - h / 2 - d, w, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(tmp, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    return;
  }

  // Marque placeholder neutre. Jamais le logo d'une entreprise réelle :
  // ce serait une fausse référence commerciale.
  engrave(ctx, p, d, (c) => {
    c.beginPath();
    c.arc(cx, cy, box * 0.46, 0, Math.PI * 2);
    c.arc(cx, cy, box * 0.38, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.beginPath();
    c.rect(cx - box * 0.22, cy - box * 0.05, box * 0.44, box * 0.1);
    c.rect(cx - box * 0.05, cy - box * 0.22, box * 0.1, box * 0.44);
    c.fill();
  });
}

/* ------------------------------------------------------------------ *
 * Couche texte — jamais cuite non plus
 * ------------------------------------------------------------------ */
function engraveText(
  ctx: CanvasRenderingContext2D,
  size: number,
  label: string,
  p: WoodPalette,
  worldY: number,
  worldMaxW: number,
  worldEm: number,
) {
  const text = label.trim().toUpperCase();
  if (!text) return;

  const maxWidth = pu(worldMaxW, size);
  let em = Math.round(pu(worldEm, size));
  const font = (s: number) =>
    `600 ${s}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(em * 0.1)}px`;
  ctx.font = font(em);
  while (em > 10 && ctx.measureText(text).width > maxWidth) {
    em -= 2;
    ctx.font = font(em);
  }
  const tracking = ctx.letterSpacing;
  ctx.restore();

  engrave(ctx, p, depthOf(size), (c) => {
    c.font = font(em);
    c.letterSpacing = tracking;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, px(0, size), py(worldY, size));
  });
}

/* ------------------------------------------------------------------ *
 * Marquage placeholder
 * ------------------------------------------------------------------ */
function drawPlaceholderMark(
  ctx: CanvasRenderingContext2D,
  size: number,
  worldY: number,
) {
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#000';
  // Des traits d'un pixel grésillent sous incidence rasante : on les épaissit
  // et on les espace, la mention reste lisible et la texture tient au filtrage.
  ctx.lineWidth = Math.max(2, size * 0.003);
  for (let x = -size; x < size * 2; x += size * 0.06) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + size, size);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(size * 0.011)}px`;
  ctx.font = `700 ${Math.round(size * 0.024)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('PLACEHOLDER', px(0, size), py(worldY, size));
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════════ *
 * Les trois faces
 * ══════════════════════════════════════════════════════════════════ */

export interface FaceSpec {
  decor: DecorId;
  /** Image déjà chargée, ou `null` → marque placeholder neutre. */
  logo: HTMLImageElement | null;
  companyName: string;
  /** Mention gravée au dos. Vide = pas de bloc d'origine. */
  backEngraving: string;
  palette: WoodPalette;
  size: number;
}

/**
 * La plaque ajourée. Bois nu, deux filets : son décor est de la matière
 * retirée, pas un dessin. Les deux faces reçoivent la même texture — c'est
 * une planche, ses deux côtés se ressemblent.
 */
export function composeCutFace(spec: Pick<FaceSpec, 'palette' | 'size'>): HTMLCanvasElement {
  const { size, palette: p } = spec;
  const [canvas, ctx] = canvasOf(size);

  drawWood(ctx, size, p, 71104);
  drawFillet(ctx, size, p);
  // Sous le bandeau plein du bas : jamais dans une découpe.
  drawPlaceholderMark(ctx, size, -0.85);

  return canvas;
}

/**
 * Le fond, côté caméra. C'est ce bois-là qu'on aperçoit par les ajours, donc
 * il est plus sombre : sans ce contraste la découpe se lit comme un dessin
 * posé à plat au lieu d'un vide. Le logo est placé dans l'ouverture centrale,
 * exactement là où la plaque avant est percée.
 */
export function composeFondRecto(spec: FaceSpec): HTMLCanvasElement {
  const { size, decor } = spec;
  const p = deepen(spec.palette);
  const [canvas, ctx] = canvasOf(size);

  drawWood(ctx, size, p, 20251);

  // Halo derrière l'ouverture : la lumière que laisserait passer un objet posé
  // devant une fenêtre. Pas un effet lumineux — un éclaircissement du bois.
  const { ARC_Y, BOTTOM } = LAYOUT.ARCH;
  const hy = (ARC_Y + LAYOUT.ARCH.HALF_W + BOTTOM) / 2;
  const halo = ctx.createRadialGradient(
    px(0, size), py(hy, size), 0,
    px(0, size), py(hy, size), pu(0.72, size),
  );
  halo.addColorStop(0, 'rgba(255, 238, 208, 0.55)');
  halo.addColorStop(1, 'rgba(255, 238, 208, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Motifs gravés dans la zone que découvre le ciel découpé. Ils passent
  // derrière les cimes : c'est ce recouvrement qui donne la profondeur.
  const rnd = mulberry32(48812);
  for (const [wx, wy] of [
    [-0.55, 0.44], [0.55, 0.44], [-0.26, 0.62], [0.26, 0.62],
    [-0.72, 0.26], [0.72, 0.26], [0, 0.4],
  ] as [number, number][]) {
    engrave(ctx, p, depthOf(size) * 0.9, (c) =>
      motif(c, decor, px(wx, size), py(wy, size), pu(0.075, size), rnd() * Math.PI * 2),
    );
  }

  drawLogo(ctx, size, spec.logo, p, 0, -0.24, 0.5);
  engraveText(ctx, size, spec.companyName, p, -0.58, 0.8, 0.12);

  return canvas;
}

/**
 * Le dos du fond. Invisible tant que la boule est montée : c'est le
 * retournement qui le découvre, et c'est donc lui qui doit payer le
 * défilement. Mention d'origine, filet, nom, marque.
 */
export function composeFondVerso(spec: FaceSpec): HTMLCanvasElement {
  const { size } = spec;
  const p = backside(spec.palette);
  const [canvas, ctx] = canvasOf(size);

  drawWood(ctx, size, p, 33907);
  drawFillet(ctx, size, p);

  engraveText(ctx, size, spec.backEngraving, p, 0.38, 1.5, 0.13);

  engrave(ctx, p, depthOf(size) * 0.8, (c) => {
    c.beginPath();
    c.rect(px(-0.34, size), py(0.19, size), pu(0.68, size), Math.max(2, pu(0.016, size)));
    c.fill();
  });

  engraveText(ctx, size, spec.companyName, p, 0.0, 1.4, 0.17);
  drawLogo(ctx, size, spec.logo, p, 0, -0.42, 0.42);
  drawPlaceholderMark(ctx, size, -0.82);

  return canvas;
}
