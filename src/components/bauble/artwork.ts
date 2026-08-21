/**
 * Forme des tracés du client.
 *
 * Un module à part, et sans dépendance : `artwork.gen.ts` (les données) et
 * `shape.ts` (le montage) le lisent tous les deux, ce qui évite un cycle entre
 * eux. Il ne contient que des types, donc il ne pèse rien à l'exécution.
 *
 * Les coordonnées sont exprimées en rayons de corps, origine au centre du
 * corps, y vers le haut — le repère de `shape.ts`.
 */

/**
 * Un anneau : x₀, y₀, x₁, y₁, … Fermé implicitement, jamais rebouclé sur son
 * premier point — un sommet dupliqué donnerait une arête de longueur nulle,
 * donc un triangle d'aire nulle et une normale non unitaire à l'extrusion.
 */
export type Ring = readonly number[];

/**
 * Une couche du médaillon gravé. Le médaillon n'est pas du trait : c'est un
 * logo, et il se lit en aplats — une coiffe pleine, un visage clair, des traits
 * sombres. Les couches se peignent dans l'ordre du tableau, chacune remplie en
 * pair-impair : un anneau imbriqué creuse celui qui le contient.
 */
export interface EngravedLayer {
  /** `burn` = le bois brûlé par la fraise ; `wood` = le bois laissé nu. */
  readonly tone: 'burn' | 'wood';
  readonly rings: readonly Ring[];
}

/** Une plaque : ce qui traverse le bois, et ce qui n'est que gravé dessus. */
export interface PlateArtwork {
  /** Le contour extérieur, sens direct. */
  readonly outline: Ring;
  /** Les vides traversants, sens indirect. */
  readonly holes: readonly Ring[];
  /** De la matière au milieu d'un vide : les contre-poinçons des lettres. */
  readonly islands: readonly Ring[];
  /** Le médaillon gravé. Pas de la géométrie : `textures.ts` le peint. */
  readonly engraving: readonly EngravedLayer[];
}

export interface BaubleArtwork {
  readonly front: PlateArtwork;
  readonly back: PlateArtwork;
}
