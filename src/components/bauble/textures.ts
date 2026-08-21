/**
 * Textures de la boule, composées au canevas à l'exécution.
 *
 * Rien n'est chargé depuis le disque : le bois, les gravures et le veinage sont
 * dessinés en JavaScript. Trois conséquences voulues :
 *
 * 1. zéro octet d'image dans le bundle ;
 * 2. aucun chemin absolu, donc le piège du sous-chemin `/ml-cse` est contourné
 *    par construction (voir CONTEXTE-TECHNIQUE, § « Le piège du chemin de base ») ;
 * 3. le logo et le nom de l'entreprise ne sont JAMAIS cuits dans la texture de
 *    base : ils sont deux couches peintes par-dessus, à la toute fin. Recomposer
 *    pour un configurateur = rappeler la fonction et poser `needsUpdate`.
 *
 * Trois faces portent un dessin, et c'est la mécanique de l'objet qui le dicte :
 *   — la plaque AVANT porte le médaillon gravé : coiffe, feuille, collerette et
 *     visage. Le reste de son décor — le ciel retiré, le lettrage — est de la
 *     matière en moins, donc de la géométrie, pas de la texture ;
 *   — la face avant de la plaque ARRIÈRE est du bois plus sombre. Son dessin à
 *     elle, la ligne de sapins et le village, est également découpé ;
 *   — le DOS de la plaque arrière porte le bloc gravé — mention d'origine, nom
 *     et logo — que le retournement révèle en fin de course.
 *
 * Seul ce dos porte encore des placeholders — le logo client et son nom —, et
 * il le dit : hachures diagonales et mention « PLACEHOLDER » incrustées. Le
 * reste est le dessin réel du client.
 *
 * Le repère est celui de `shape.ts` : un carré de côté 2 × FRAME.HALF centré
 * sur la boîte englobante de la silhouette. Les deux fichiers DOIVENT lire les
 * mêmes constantes, sinon le décor glisse par rapport à la découpe.
 */
import type { EngravedLayer, Ring } from './artwork';
import { FRAME } from './shape';

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
 * Mise en page du dos gravé
 *
 * La plaque arrière est AJOURÉE elle aussi : le ciel est retiré au-dessus de
 * y = 0,05, les toits descendent à −0,19, les portes à −0,33. Sous cette ligne
 * le bois est plein d'un bord à l'autre, et c'est la seule bande où le bloc
 * gravé peut vivre. Déplacer une de ces valeurs vers le haut, c'est écrire
 * dans le vide.
 * ------------------------------------------------------------------ */
const BACK = {
  /** Plafond de la zone pleine. Rien de gravé au-dessus. */
  SOLID_TOP: -0.33,
  LOGO_Y: -0.43,
  LOGO_BOX: 0.26,
  RULE_Y: -0.585,
  ORIGIN_Y: -0.68,
  ORIGIN_EM: 0.09,
  ORIGIN_W: 1.05,
  /**
   * Le nom descend bas, et le corps est rond : à cette hauteur la corde ne
   * fait plus qu'un rayon de large. La largeur maximale est calée dessus, pas
   * sur le diamètre — sinon les lettres des extrémités tombent hors du bois.
   */
  NAME_Y: -0.8,
  NAME_EM: 0.12,
  NAME_W: 0.9,
  MARK_Y: -0.245,
};

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
 *
 * `draw` peut remplir ou tracer : les deux styles sont posés avant l'appel.
 * ------------------------------------------------------------------ */
function engrave(
  ctx: CanvasRenderingContext2D,
  p: WoodPalette,
  depth: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  ctx.save();
  ctx.translate(0, -depth);
  ctx.fillStyle = p.lip;
  ctx.strokeStyle = p.lip;
  ctx.globalAlpha = 0.55;
  draw(ctx);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = p.burn;
  ctx.strokeStyle = p.burn;
  ctx.globalAlpha = 0.82;
  draw(ctx);
  ctx.restore();
}

const depthOf = (size: number) => Math.max(1.5, size * 0.0026);

/* ------------------------------------------------------------------ *
 * Le médaillon du client
 *
 * En APLATS, et surtout pas au trait. Rendre ces contours au filet donne un
 * masque : deux yeux et une bouche cernés, flottant sur du bois. Le logo
 * imprimé est fait de masses — coiffe pleine, visage clair, traits sombres —,
 * et c'est ce que le générateur livre : des couches, chacune avec sa teinte.
 *
 * Deux teintes, deux reliefs opposés, et c'est ce qui vend le creux :
 *   `burn` la fraise est passée. Lèvre claire AU-DESSUS du tracé, fond brûlé
 *         par-dessus ; la frange qui dépasse fait le bord du creux.
 *   `wood` la matière est restée, c'est autour qu'on a creusé. Ombre portée
 *         EN DESSOUS, puis le bois nu remis à sa place — le vrai, veinage
 *         compris, découpé dans la planche d'origine. Un aplat de couleur
 *         ferait un autocollant.
 * ------------------------------------------------------------------ */
function ringsPath(c: CanvasRenderingContext2D, size: number, rings: readonly Ring[]) {
  c.beginPath();
  for (const r of rings) {
    c.moveTo(px(r[0], size), py(r[1], size));
    for (let i = 2; i < r.length; i += 2) c.lineTo(px(r[i], size), py(r[i + 1], size));
    c.closePath();
  }
}

function paintMedallion(
  ctx: CanvasRenderingContext2D,
  size: number,
  layers: readonly EngravedLayer[],
  p: WoodPalette,
  bare: HTMLCanvasElement,
) {
  const d = depthOf(size);
  for (const layer of layers) {
    if (layer.tone === 'burn') {
      engrave(ctx, p, d, (c) => {
        ringsPath(c, size, layer.rings);
        c.fill('evenodd');
      });
      continue;
    }
    ctx.save();
    ctx.translate(0, d);
    ctx.fillStyle = p.burn;
    ctx.globalAlpha = 0.5;
    ringsPath(ctx, size, layer.rings);
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    ringsPath(ctx, size, layer.rings);
    ctx.clip('evenodd');
    ctx.drawImage(bare, 0, 0);
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ *
 * Filet gravé, posé entre les ajours et le bord : il ne croise jamais la
 * découpe. Sur l'avant, la fenêtre s'arrête à 0,86 ; sur l'arrière, les toits
 * culminent à 0,87. Le filet vit au-delà, et le corps va jusqu'à 1.
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
  ring(0.945, 0.012);
  ring(0.922, 0.006);
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

  // Marque placeholder neutre. Jamais le logo d'une entreprise réelle autre
  // que celle du site : ce serait une fausse référence commerciale.
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
  /** Image déjà chargée, ou `null` → marque placeholder neutre. */
  logo: HTMLImageElement | null;
  companyName: string;
  /** Mention gravée au dos. Vide = pas de bloc d'origine. */
  backEngraving: string;
  palette: WoodPalette;
  size: number;
}

/**
 * La plaque avant. Le médaillon y est gravé au trait ; le ciel et le lettrage
 * n'y sont pas dessinés, ils sont absents du bois.
 *
 * Les deux faces de la plaque reçoivent cette même texture. Son verso ne se
 * voit jamais — l'avant ne pivote que d'un tiers de radian, et la caméra ne
 * bouge pas —, donc la gravure en miroir qui s'y trouve est sans conséquence.
 */
export function composeFrontFace(
  spec: Pick<FaceSpec, 'palette' | 'size'> & { engraving: readonly EngravedLayer[] },
): HTMLCanvasElement {
  const { size, palette: p } = spec;

  // La planche nue est peinte à part : les couches `wood` du médaillon y
  // rechargent le bois exact — veines, nœuds, vignettage — là où elles doivent
  // rester en relief.
  const [bare, bctx] = canvasOf(size);
  drawWood(bctx, size, p, 71104);

  const [canvas, ctx] = canvasOf(size);
  ctx.drawImage(bare, 0, 0);
  drawFillet(ctx, size, p);
  paintMedallion(ctx, size, spec.engraving, p, bare);

  return canvas;
}

/**
 * La face avant de la plaque arrière. C'est ce bois-là qu'on aperçoit par la
 * fenêtre du ciel, donc il est plus sombre : sans ce contraste la découpe se
 * lit comme un dessin posé à plat au lieu d'un vide.
 *
 * Aucun décor n'y est peint — sapins, toits et fenêtres sont découpés. Reste
 * une montée de lumière au ras de la ligne d'horizon, qui donne au village un
 * fond de ciel bas plutôt qu'une planche uniforme.
 */
export function composeBackFront(
  spec: Pick<FaceSpec, 'palette' | 'size'>,
): HTMLCanvasElement {
  const { size } = spec;
  const p = deepen(spec.palette);
  const [canvas, ctx] = canvasOf(size);

  drawWood(ctx, size, p, 20251);

  const glow = ctx.createRadialGradient(
    px(0, size), py(0.06, size), 0,
    px(0, size), py(0.06, size), pu(0.9, size),
  );
  glow.addColorStop(0, 'rgba(255, 238, 208, 0.4)');
  glow.addColorStop(1, 'rgba(255, 238, 208, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  drawFillet(ctx, size, p);

  return canvas;
}

/**
 * Le dos de la plaque arrière. Invisible tant que la boule est montée : c'est
 * le retournement qui le découvre, et c'est donc lui qui doit payer le
 * défilement. Logo, filet, mention d'origine, nom.
 *
 * Tout tient sous BACK.SOLID_TOP, la seule bande où cette plaque est pleine.
 */
export function composeBackBack(spec: FaceSpec): HTMLCanvasElement {
  const { size } = spec;
  const p = backside(spec.palette);
  const [canvas, ctx] = canvasOf(size);

  drawWood(ctx, size, p, 33907);
  drawFillet(ctx, size, p);

  drawLogo(ctx, size, spec.logo, p, 0, BACK.LOGO_Y, BACK.LOGO_BOX);

  engrave(ctx, p, depthOf(size) * 0.8, (c) => {
    c.beginPath();
    c.rect(px(-0.3, size), py(BACK.RULE_Y, size), pu(0.6, size), Math.max(2, pu(0.014, size)));
    c.fill();
  });

  engraveText(ctx, size, spec.backEngraving, p, BACK.ORIGIN_Y, BACK.ORIGIN_W, BACK.ORIGIN_EM);
  engraveText(ctx, size, spec.companyName, p, BACK.NAME_Y, BACK.NAME_W, BACK.NAME_EM);

  // Le logo et le nom ci-dessus sont les DEUX seuls placeholders qui restent
  // dans la scène : la marque le dit, et elle ne dit qu'eux.
  drawPlaceholderMark(ctx, size, BACK.MARK_Y);

  return canvas;
}
