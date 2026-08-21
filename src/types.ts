import type { ImageMetadata } from 'astro';

/**
 * Contrat de données d'une landing page client.
 *
 * Une landing = un fichier de config dans src/clients/ qui satisfait ce type.
 * Aucun texte, aucune couleur, aucune image ne doit être écrit en dur dans un
 * composant : tout passe par ici. C'est ce qui rend le template dupliquable.
 */

/** Palette de la landing. Seul `accent` change vraiment d'un client à l'autre. */
export interface Palette {
  /** Couleur de marque dominante (titres, boutons pleins). */
  heading: string;
  /** Accent principal : eyebrows, liens, cachet de cire, focus. */
  accent: string;
  /** Variante foncée de l'accent, pour les états hover. */
  accentDark: string;
  /** Touche métallique discrète (ornements, particules). */
  gold: string;
  /** Fond de page. */
  bg: string;
  /** Fond des surfaces surélevées (cartes, panneaux). */
  surface: string;
}

export interface Product {
  /** Identifiant stable : sert d'ancre de pré-sélection dans le formulaire. */
  slug: string;
  /** Nom affiché sur la carte ET dans la liste déroulante du formulaire. */
  name: string;
  description: string;
  /** Ligne de provenance, sous la description. */
  provenance: string;
  image: ImageMetadata;
  /** Texte alternatif : décrit la pièce, jamais « photo de ». */
  alt: string;
  /** Badge en surimpression sur la photo. Omis = pas de badge. */
  tag?: string;
}

export interface GalleryPhoto {
  image: ImageMetadata;
  alt: string;
}

export interface Value {
  /** Clé d'icône résolue dans components/Icon.astro. */
  icon: 'origin' | 'engrave' | 'clock' | 'gift';
  title: string;
  text: string;
}

/**
 * Jeu de tracés d'une boule. Chaque identifiant renvoie au dessin réel d'un
 * client, converti depuis ses fichiers SVG par `tools/bauble-artwork.mjs` : la
 * silhouette, ce qui traverse le bois et ce qui n'est que gravé dessus.
 * Aucun fichier image, donc aucun chemin à faire passer par BASE_URL.
 */
export type ArtworkId = 'alsace-lait';

/**
 * Boule de Noël en bois usinée CNC : section à effet 3D pilotée par le
 * défilement. Gamme distincte des médailles en PEHD recyclé — ne pas mélanger
 * les deux discours dans les textes.
 *
 * L'objet est fait de DEUX plaques ajourées, montées face contre face. Le ciel
 * est retiré des deux, mais pas autour du même dessin : devant le médaillon de
 * la marque, derrière une ligne de sapins et un village. C'est ce décalage qui
 * donne la profondeur — on regarde à travers l'avant et on voit l'arrière. Le
 * défilement les sépare, puis retourne celle de derrière pour découvrir son dos
 * gravé.
 *
 * Clé optionnelle : une landing qui ne la déclare pas n'affiche pas la section,
 * et les configs existantes restent valides.
 */
export interface Bauble {
  /** Textes commerciaux. Ils vivent en HTML hors du canevas : le canevas est
      décoratif et `aria-hidden`, il ne doit porter aucune information. */
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Tracés de l'objet. */
  artwork: ArtworkId;
  /**
   * Logo gravé au dos, dans le bloc que le retournement révèle. Omis = marque
   * placeholder neutre. Ne jamais y mettre le logo d'une entreprise qui n'est
   * pas cliente : ce serait une fausse référence commerciale.
   */
  logoUrl?: string;
  /** Nom gravé au dos, sous la mention d'origine. */
  companyName: string;
  /** Mention gravée au dos, révélée par le retournement. */
  backEngraving: string;
}

export interface Client {
  /** Slug technique du client (nom de fichier, identifiant de build). */
  id: string;
  /** Nom affiché du client. Vide = version générique de l'agence. */
  name: string;
  palette: Palette;

  meta: {
    title: string;
    description: string;
  };

  header: {
    /** Marque affichée à gauche. Remplacée par le nom du client si personnalisé. */
    brand: string;
    tagline: string;
    edition: string;
  };

  hero: {
    eyebrow: string;
    /** Première ligne du titre, au-dessus du nom mis en accent. */
    titleLead: string;
    /** Mot de liaison avant le nom (« de », « d'»…). */
    titleJoin: string;
    /** Nom mis en italique et en accent. */
    titleAccent: string;
    subtitle: string;
    cta: string;
    /**
     * Second appel à l'action, discret, à côté du principal. Omis = absent.
     * `href` est un chemin relatif au site (sans barre initiale) : le
     * composant le préfixe par BASE_URL, sinon il casse sous /ml-cse.
     */
    ctaSecondary?: {
      label: string;
      href: string;
    };
  };

  /** Section « boule de Noël bois ». Absente = section non rendue. */
  bauble?: Bauble;

  products: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Product[];
  };

  gallery: {
    eyebrow: string;
    title: string;
    intro: string;
    photos: GalleryPhoto[];
  };

  values: Value[];

  contact: {
    eyebrow: string;
    title: string;
    intro: string;
    lead: string;
    /** Puces de réassurance, séparées par une pastille dorée. */
    reassurance: string[];
    person: {
      name: string;
      role: string;
      email: string;
      phone: string;
      /** Téléphone au format lien tel: (sans espaces). */
      phoneHref: string;
    };
  };

  form: {
    /** Nom du formulaire Netlify. Doit être unique par site déployé. */
    netlifyName: string;
    quantityDefault: number;
    consent: string;
    submit: string;
    note: string;
    success: {
      eyebrow: string;
      title: string;
      text: string;
    };
  };

  footer: {
    /** Agence qui signe la réalisation. */
    agency: string;
    /** Ligne centrale, remplacée si la landing est personnalisée. */
    line: string;
    year: string;
  };

  /**
   * Variantes appliquées côté client quand l'URL porte `?nom=Entreprise`.
   * Chaque gabarit reçoit le nom saisi via le jeton `{nom}`.
   * Permet d'envoyer un lien de prospection personnalisé sans rebuild.
   */
  personalization: {
    metaTitle: string;
    metaDescription: string;
    heroLead: string;
    heroJoin: string;
    contactTitle: string;
    footerLine: string;
  };
}
