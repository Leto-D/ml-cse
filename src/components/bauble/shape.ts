/**
 * Silhouette et découpe de la boule, en géométrie vectorielle.
 *
 * L'objet n'est pas un disque : c'est la silhouette d'une boule de Noël —
 * corps rond, patte de suspension, œillet percé — et la version avant est une
 * PLAQUE AJOURÉE dont les vides forment le décor. Le fond, lui, est plein :
 * c'est lui qu'on aperçoit à travers les ajours.
 *
 * Les ajours sont de vrais trous dans la géométrie, pas un masque alpha. Ce
 * choix coûte quelques centaines de triangles et les rend en échange
 * réellement traversants : la fraise laisse une paroi, et cette paroi est
 * visible dès que la plaque prend du trois-quarts. Un masque alpha aurait
 * donné des bords d'épaisseur nulle, ce qui trahit le contreplaqué imprimé au
 * moment précis où la scène doit vendre le massif.
 *
 * Toutes les longueurs sont exprimées en rayons de corps (R = 1).
 */
import {
  BufferAttribute,
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
} from 'three';
import type { DecorId } from '~/types';

/* ── Silhouette ──────────────────────────────────────────────────────────── */
export const SIL = {
  /** Rayon du corps. Unité de toute la scène. */
  R: 1,
  /** Demi-largeur de la patte de suspension. */
  TAB_HALF_W: 0.2,
  /** Centre de l'arrondi qui coiffe la patte. */
  TAB_ARC_Y: 1.12,
  /** Œillet percé dans la patte, centré sur l'arrondi. */
  HOLE_R: 0.085,
};

/**
 * Cadre de référence des textures. La silhouette n'est pas carrée (2 × 2,32) ;
 * les UV sont calculés dans un CARRÉ de côté 2 × HALF centré sur la boîte
 * englobante, sinon le bois serait étiré verticalement. `textures.ts` dessine
 * dans ce même carré : les deux fichiers doivent lire les mêmes constantes.
 */
export const FRAME = {
  /** Demi-côté du carré de référence. */
  HALF: (SIL.TAB_ARC_Y + SIL.TAB_HALF_W + SIL.R) / 2,
  /** Décalage de la boîte englobante par rapport au centre du corps. */
  CY: (SIL.TAB_ARC_Y + SIL.TAB_HALF_W - SIL.R) / 2,
};

/* ── Découpe ─────────────────────────────────────────────────────────────── */
export const LAYOUT = {
  /** Rayon utile. Au-delà on garde du bois plein : c'est le jonc de la boule. */
  FIELD: 0.86,
  /** Ligne de sol du paysage découpé. */
  SKY_BASE: 0.16,
  /** Ouverture centrale. C'est par elle qu'on voit le fond et le logo. */
  ARCH: { HALF_W: 0.46, ARC_Y: -0.44, BOTTOM: -0.68 },
  /** Petits ajours d'accompagnement, de part et d'autre de l'ouverture. */
  ACCENTS: [
    [-0.68, -0.28],
    [0.68, -0.28],
    [-0.7, 0.02],
    [0.7, 0.02],
  ] as ReadonlyArray<readonly [number, number]>,
  ACCENT_R: 0.09,
};

/**
 * Longueur de corde visée, en rayons de corps. TOUS les arcs sont échantillonnés
 * à ce pas, et c'est le point important : `curveSegments` de three donne le même
 * nombre de segments à un arc quel que soit son rayon. L'arrondi de la patte
 * (rayon 0,2) se retrouvait cinq fois plus finement découpé que le corps, et la
 * triangulation d'oreille répondait à ce nuage de points serrés par des
 * centaines d'aiguilles — des triangles au rapport d'aspect de plusieurs
 * millions, qui scintillent dès que l'objet bouge. Un pas constant supprime la
 * cause.
 */
const TESS = 0.06;

/**
 * Sans arc de courbe dans les tracés, cette valeur ne sert plus : three donne
 * toujours une résolution de 1 aux segments droits. On la garde explicite pour
 * que personne ne réintroduise un `absarc` en croyant qu'elle le rattrapera.
 */
const CURVE_SEGMENTS = 12;

/**
 * Échantillonne un arc en segments droits et l'ajoute au tracé. Le point de
 * départ est supposé déjà posé. `dropLast` s'arrête juste avant l'arrivée,
 * quand `closePath()` doit tirer la dernière corde : sans lui on obtient un
 * segment de longueur nulle, donc un triangle d'aire nulle et une normale non
 * unitaire à l'extrusion.
 */
function arcTo(
  p: Path,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  dropLast = false,
) {
  const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * r) / TESS));
  const end = dropLast ? n - 1 : n;
  for (let i = 1; i <= end; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
}

/* ------------------------------------------------------------------ *
 * Contour extérieur
 * ------------------------------------------------------------------ */
function outline(): Shape {
  const { R, TAB_HALF_W: w, TAB_ARC_Y: ty } = SIL;
  // Angle auquel les flancs de la patte rencontrent le corps.
  const th = Math.acos(w / R);
  const yj = Math.sin(th) * R;

  const s = new Shape();
  s.moveTo(w, yj);
  s.lineTo(w, ty);
  arcTo(s, 0, ty, w, 0, Math.PI);
  s.lineTo(-w, yj);
  // Le corps, dans le sens direct, de la jonction gauche à la jonction droite.
  // La dernière corde est laissée à `closePath()`, qui rejoint exactement le
  // point de départ — sinon l'arithmétique flottante en pose un second, à
  // quelques 10⁻¹⁶ du premier, et la triangulation bute dessus.
  arcTo(s, 0, 0, R, Math.PI - th, th + Math.PI * 2, true);
  s.closePath();
  return s;
}

function hangingHole(): Path {
  const { HOLE_R: r, TAB_ARC_Y: cy } = SIL;
  // Petit et toujours vu de près : on lui laisse plus de segments que son
  // périmètre n'en réclamerait.
  const n = 20;
  const p = new Path();
  p.moveTo(r, cy);
  for (let i = 1; i < n; i++) {
    const a = (-2 * Math.PI * i) / n;
    p.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  p.closePath();
  return p;
}

/* ------------------------------------------------------------------ *
 * Le ciel découpé
 *
 * Polarité voulue : ce n'est pas la ligne d'arbres qu'on retire, c'est le ciel
 * AUTOUR. Les arbres restent de la matière, rattachés au bandeau plein du bas.
 * Découper les arbres eux-mêmes laisserait des îlots qui tomberaient de la
 * plaque à l'usinage.
 * ------------------------------------------------------------------ */
function clampField(x: number, y: number): [number, number] {
  const lim = LAYOUT.FIELD * 0.97;
  const r = Math.hypot(x, y);
  return r <= lim ? [x, y] : [(x * lim) / r, (y * lim) / r];
}

/**
 * Profil des cimes, de gauche à droite. C'est lui que `decor` choisit.
 *
 * Les points DOIVENT être dédoublonnés. Deux points consécutifs confondus
 * donnent une oreille de longueur nulle à la triangulation et un quadrilatère
 * dégénéré à l'extrusion : des triangles d'aire nulle sur la face, une normale
 * non unitaire sur la paroi, et un maillage qui scintille dès que l'objet
 * bouge. Les trois profils tombent naturellement sur ce cas — chacun se
 * termine sur la ligne de sol, exactement là où le point de fermeture est déjà
 * posé.
 */
function skyline(decor: DecorId, x0: number, base: number): [number, number][] {
  const pts: [number, number][] = [];
  const EPS = 1e-5;
  const put = (q: [number, number]) => {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - q[0]) < EPS && Math.abs(last[1] - q[1]) < EPS) return;
    pts.push(q);
  };
  put([-x0, base]);
  const n = decor === 'sapins' ? 7 : decor === 'etoiles' ? 5 : 9;
  const step = (2 * x0) / n;

  for (let i = 0; i < n; i++) {
    const left = -x0 + i * step;
    const mid = left + step / 2;
    // Les motifs du bord sont rognés par le cercle : on les tasse d'avance.
    const t = 1 - Math.abs(mid) / x0;
    const rise = 0.13 + 0.46 * Math.pow(t, 1.4);

    if (decor === 'sapins') {
      put(clampField(mid, base + rise));
      put([left + step, base]);
    } else if (decor === 'etoiles') {
      // Coteaux arrondis : le relief reste bas, les étoiles font le décor.
      for (let k = 1; k <= 6; k++) {
        const u = k / 6;
        put(clampField(left + step * u, base + rise * 0.72 * Math.sin(Math.PI * u)));
      }
    } else {
      // Congère : une ondulation douce, sans pointe.
      for (let k = 1; k <= 4; k++) {
        const u = k / 4;
        put(
          clampField(left + step * u, base + rise * 0.55 * (1 - Math.cos(2 * Math.PI * u)) * 0.5),
        );
      }
    }
  }

  put([x0, base]);
  return pts;
}

function skyCut(decor: DecorId): Path {
  const { FIELD: F, SKY_BASE: base } = LAYOUT;
  const x0 = Math.sqrt(F * F - base * base);
  const a = Math.atan2(base, x0);

  const p = new Path();
  const pts = skyline(decor, x0, base);
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  arcTo(p, 0, 0, F, a, Math.PI - a, true);
  p.closePath();
  return p;
}

/* ------------------------------------------------------------------ *
 * L'ouverture centrale
 * ------------------------------------------------------------------ */
function archCut(): Path {
  const { HALF_W: w, ARC_Y: cy, BOTTOM: b } = LAYOUT.ARCH;
  const p = new Path();
  p.moveTo(-w, b);
  p.lineTo(-w, cy);
  arcTo(p, 0, cy, w, Math.PI, 0);
  p.lineTo(w, b);
  p.closePath();
  return p;
}

/* ------------------------------------------------------------------ *
 * Ajours d'accompagnement
 * Tracés en lignes droites : ils ne consomment donc pas `curveSegments`, et la
 * facture reste celle d'une découpe laser plutôt que d'un rendu vectoriel.
 * ------------------------------------------------------------------ */
function accentCut(decor: DecorId, x: number, y: number, r: number): Path {
  const p = new Path();
  const pts: [number, number][] = [];

  if (decor === 'sapins') {
    const S: [number, number][] = [
      [0, 1], [0.38, 0.3], [0.2, 0.3], [0.62, -0.14], [0.34, -0.14], [0.86, -0.58],
      [0.14, -0.58], [0.14, -1], [-0.14, -1], [-0.14, -0.58], [-0.86, -0.58],
      [-0.34, -0.14], [-0.62, -0.14], [-0.2, 0.3], [-0.38, 0.3],
    ];
    for (const [sx, sy] of S) pts.push([x + sx * r, y + sy * r]);
  } else {
    // Étoile à cinq branches, ou flocon à six : même construction, deux
    // paramètres. Le flocon est plus fin, ce qui l'éloigne de l'étoile.
    const branches = decor === 'etoiles' ? 5 : 6;
    const inner = decor === 'etoiles' ? 0.44 : 0.3;
    for (let i = 0; i < branches * 2; i++) {
      const rad = i % 2 === 0 ? r : r * inner;
      const a = (i * Math.PI) / branches - Math.PI / 2;
      pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
    }
  }

  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

/* ------------------------------------------------------------------ *
 * Assemblage
 * ------------------------------------------------------------------ */

/** UV dans le carré de référence, u croissant vers les x locaux positifs. */
function applyFrameUV(g: BufferGeometry) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const d = 2 * FRAME.HALF;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + FRAME.HALF) / d;
    uv[i * 2 + 1] = (pos.getY(i) + FRAME.HALF) / d;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
}

/**
 * `ExtrudeGeometry` produit deux groupes : 0 = les couvercles, 1 = les parois.
 * Les couvercles doivent DISPARAÎTRE : ils sont exactement coplanaires avec les
 * deux faces texturées, avec la même triangulation, et le conflit de
 * profondeur qui en résulte est le défaut visuel qu'on a chassé pendant des
 * jours.
 *
 * Il ne suffit PAS de retirer leur groupe. `WebGLRenderer.projectObject` ne
 * consulte `geometry.groups` que si le mesh porte un TABLEAU de matériaux ;
 * avec un matériau unique — le cas ici — il empile la géométrie entière et
 * dessine tout le tampon, groupes ignorés. Découper les groupes est donc un
 * geste sans effet, et c'est précisément le piège dans lequel ce fichier était
 * tombé.
 *
 * On tranche donc les sommets pour de bon. L'extrusion est non indexée et les
 * parois y forment une plage contiguë : une copie du bon intervalle suffit, et
 * le tampon perd au passage les deux tiers de son poids.
 */
function wallsOnly(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  // Contrat d'`ExtrudeGeometry` depuis toujours ; si three venait à le changer,
  // on préfère une tranche absente à un couvercle de retour : le premier se
  // voit et se corrige, le second rejoue exactement ce bug-ci.
  const walls = g.groups.find((gr) => gr.materialIndex === 1);
  if (!walls) {
    g.dispose();
    return out;
  }

  for (const name of ['position', 'normal'] as const) {
    const a = g.getAttribute(name);
    const src = a.array as Float32Array;
    const from = walls.start * a.itemSize;
    out.setAttribute(
      name,
      new BufferAttribute(src.slice(from, from + walls.count * a.itemSize), a.itemSize),
    );
  }
  g.dispose();
  return out;
}

export interface PlateGeometry {
  /** Une face. La seconde est le même tampon, tourné d'un demi-tour. */
  face: BufferGeometry;
  /** Les parois : contour, œillet et tous les ajours. */
  edge: BufferGeometry;
  dispose: () => void;
}

export function buildPlate(
  decor: DecorId,
  cutouts: boolean,
  thickness: number,
): PlateGeometry {
  const shape = outline();
  shape.holes.push(hangingHole());
  if (cutouts) {
    shape.holes.push(skyCut(decor), archCut());
    for (const [x, y] of LAYOUT.ACCENTS) {
      shape.holes.push(accentCut(decor, x, y, LAYOUT.ACCENT_R));
    }
  }

  const face = new ShapeGeometry(shape, CURVE_SEGMENTS);
  face.translate(0, -FRAME.CY, 0);
  applyFrameUV(face);

  const extruded = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: CURVE_SEGMENTS,
  });
  extruded.translate(0, -FRAME.CY, -thickness / 2);
  // La tranche est unie : `wallsOnly` ne recopie ni les UV ni les couvercles.
  const edge = wallsOnly(extruded);

  return {
    face,
    edge,
    dispose: () => {
      face.dispose();
      edge.dispose();
    },
  };
}
