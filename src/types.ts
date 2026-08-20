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
 * Vocabulaire de la découpe. Il choisit le profil de la ligne d'arbres et la
 * forme des petits ajours qui l'accompagnent. Tout est tracé en vectoriel
 * (voir components/bauble/shape.ts) : aucun fichier image, donc aucun chemin
 * à faire passer par BASE_URL.
 */
export type DecorId = 'etoiles' | 'sapins' | 'flocons';

/**
 * Boule de Noël en bois usinée CNC : section à effet 3D pilotée par le
 * défilement. Gamme distincte des médailles en PEHD recyclé — ne pas mélanger
 * les deux discours dans les textes.
 *
 * L'objet est fait de DEUX plaques qui ne jouent pas le même rôle : une plaque
 * ajourée devant, dont les vides forment le décor, et un fond plein derrière,
 * qu'on aperçoit à travers les ajours. Le défilement les sépare et retourne le
 * fond pour découvrir son dos gravé.
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
  /** Vocabulaire de la découpe. */
  decor: DecorId;
  /**
   * Logo posé dans l'ouverture centrale du fond, et repris au dos. Omis =
   * marque placeholder neutre. Ne jamais y mettre le logo d'une entreprise qui
   * n'est pas cliente : ce serait une fausse référence commerciale.
   */
  logoUrl?: string;
  /** Nom gravé sous le logo, et repris au dos. */
  companyName: string;
  /** Mention gravée au dos du fond, révélée par le retournement. */
  backEngraving: string;
  /**
   * La plaque avant est-elle ajourée ? Faux = deux plaques pleines, pour une
   * gamme sans découpe. La réponse tranchée pour la gamme bois est « oui » :
   * les ajours SONT le décor.
   */
  frontHasCutouts: boolean;
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
