/**
 * Géométrie des deux plaques, construite à partir du dessin du client.
 *
 * L'objet n'est pas un disque : c'est la silhouette d'une boule de Noël —
 * corps rond, patte de suspension, œillet percé — et les DEUX plaques sont
 * ajourées. C'est ce qui fait la profondeur : on regarde à travers l'avant et
 * on voit l'arrière.
 *
 *   AVANT   le ciel est retiré autour du médaillon Alsace Lait, et les dix
 *           lettres du nom traversent la bande du bas. La coiffe, la feuille,
 *           la collerette et le visage ne traversent pas : ce sont des traits
 *           gravés, `textures.ts` s'en charge.
 *   ARRIÈRE le ciel est retiré autour d'une ligne de sapins ; deux toits,
 *           cinq portes et trois fenêtres rondes achèvent le village.
 *
 * Les ajours sont de vrais trous dans la géométrie, pas un masque alpha. Ce
 * choix coûte quelques milliers de triangles et les rend en échange réellement
 * traversants : la fraise laisse une paroi, et cette paroi est visible dès que
 * la plaque prend du trois-quarts. Un masque alpha aurait donné des bords
 * d'épaisseur nulle, ce qui trahit le contreplaqué imprimé au moment précis où
 * la scène doit vendre le massif.
 *
 * Les tracés eux-mêmes ne sont pas ici : ils viennent de `artwork.gen.ts`, que
 * `tools/bauble-artwork.mjs` produit à partir des fichiers SVG du client. Ce
 * fichier ne fait que les monter.
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
import type { PlateArtwork, Ring } from './artwork';
import { SILHOUETTE_BOX } from './artwork.gen';

/** Rayon du corps. Unité de toute la scène. */
export const BODY_R = 1;

/**
 * Cadre de référence des textures. La silhouette n'est pas carrée (2 × 2,31) ;
 * les UV sont calculés dans un CARRÉ de côté 2 × HALF centré sur la boîte
 * englobante, sinon le bois serait étiré verticalement. `textures.ts` dessine
 * dans ce même carré : les deux fichiers doivent lire les mêmes constantes.
 */
export const FRAME = {
  /** Demi-côté du carré de référence. */
  HALF: (SILHOUETTE_BOX.top - SILHOUETTE_BOX.bottom) / 2,
  /** Décalage de la boîte englobante par rapport au centre du corps. */
  CY: (SILHOUETTE_BOX.top + SILHOUETTE_BOX.bottom) / 2,
};

/* ── Montage ──────────────────────────────────────────────────────────────── */

/**
 * Les anneaux sont déjà des polygones : aucune courbe ne subsiste dans les
 * tracés, donc `curveSegments` de three ne sert plus à rien. On la fixe à 1
 * pour que personne ne croie la régler en la changeant.
 */
const CURVE_SEGMENTS = 1;

function trace<T extends Path>(p: T, ring: Ring): T {
  p.moveTo(ring[0], ring[1]);
  for (let i = 2; i < ring.length; i += 2) p.lineTo(ring[i], ring[i + 1]);
  p.closePath();
  return p;
}

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
 * `ExtrudeGeometry` produit deux groupes par forme : 0 = les couvercles,
 * 1 = les parois. Les couvercles doivent DISPARAÎTRE : ils sont exactement
 * coplanaires avec les deux faces texturées, avec la même triangulation, et le
 * conflit de profondeur qui en résulte est le défaut visuel qu'on a chassé
 * pendant des jours.
 *
 * Il ne suffit PAS de retirer leur groupe. `WebGLRenderer.projectObject` ne
 * consulte `geometry.groups` que si le mesh porte un TABLEAU de matériaux ;
 * avec un matériau unique — le cas ici — il empile la géométrie entière et
 * dessine tout le tampon, groupes ignorés. Découper les groupes est donc un
 * geste sans effet, et c'est précisément le piège dans lequel ce fichier était
 * tombé.
 *
 * On tranche donc les sommets pour de bon. L'extrusion est non indexée et les
 * parois de chaque forme y occupent une plage contiguë : il suffit de recopier
 * les bonnes plages, et le tampon perd au passage les deux tiers de son poids.
 */
function wallsOnly(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  // Contrat d'`ExtrudeGeometry` depuis toujours ; si three venait à le changer,
  // on préfère une tranche absente à un couvercle de retour : le premier se
  // voit et se corrige, le second rejoue exactement ce bug-ci.
  const walls = g.groups.filter((gr) => gr.materialIndex === 1);
  const total = walls.reduce((n, w) => n + w.count, 0);

  for (const name of ['position', 'normal'] as const) {
    const a = g.getAttribute(name);
    const src = a.array as Float32Array;
    const dst = new Float32Array(total * a.itemSize);
    let at = 0;
    for (const w of walls) {
      dst.set(src.subarray(w.start * a.itemSize, (w.start + w.count) * a.itemSize), at);
      at += w.count * a.itemSize;
    }
    out.setAttribute(name, new BufferAttribute(dst, a.itemSize));
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

/**
 * Une plaque à partir de son tracé.
 *
 * Les îlots sont des formes À PART, et pas des trous dans les trous : `Shape`
 * ne sait percer qu'un niveau. `ShapeGeometry` et `ExtrudeGeometry` acceptent
 * en revanche un tableau de formes et concatènent les tampons, ce qui revient
 * au même pour un coût nul.
 */
export function buildPlate(art: PlateArtwork, thickness: number): PlateGeometry {
  const plate = trace(new Shape(), art.outline);
  for (const h of art.holes) plate.holes.push(trace(new Path(), h));

  const shapes = [plate, ...art.islands.map((r) => trace(new Shape(), r))];

  const face = new ShapeGeometry(shapes, CURVE_SEGMENTS);
  face.translate(0, -FRAME.CY, 0);
  applyFrameUV(face);
  // Les groupes ne servent à rien ici — un seul matériau — et le rendu les
  // ignore ; on les retire pour ne pas laisser croire le contraire.
  face.clearGroups();

  const extruded = new ExtrudeGeometry(shapes, {
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
