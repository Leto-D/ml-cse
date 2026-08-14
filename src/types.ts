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
