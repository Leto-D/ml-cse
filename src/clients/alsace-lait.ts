import type { Client } from '~/types';

import medaillonDiorama from '~/assets/galerie-1.jpg';
import etoilesForestieres from '~/assets/galerie-2.jpg';
import supportTelephone from '~/assets/galerie-3.jpg';
import medaillonBouteille from '~/assets/galerie-4.jpg';
import collectionMedaillons from '~/assets/galerie-5.jpg';
import coeurAlsacien from '~/assets/galerie-6.jpg';

/**
 * Landing Alsace Lait — collection de Noël.
 *
 * Pour créer la landing d'un autre client : copier ce fichier, changer les
 * textes, les images et `palette.accent`, puis pointer src/clients/index.ts
 * dessus. Aucun composant n'est à toucher.
 */
export const alsaceLait: Client = {
  id: 'alsace-lait',
  name: 'Alsace Lait',

  palette: {
    heading: '#1A2C5E',
    accent: '#D32F2F',
    accentDark: '#B71C1C',
    gold: '#C5A059',
    bg: '#F9F6F0',
    surface: '#FFFFFF',
  },

  meta: {
    title: "Cadeaux d'entreprise personnalisés — Réusit",
    description:
      "Collection de cadeaux d'entreprise personnalisables pour les fêtes de fin d'année. Médaillons, boules et supports de téléphone en bois et plastique recyclé, fabriqués en Alsace.",
  },

  header: {
    brand: 'Réusit',
    tagline: "Cadeaux d'entreprise",
    edition: 'Édition 2026',
  },

  hero: {
    eyebrow: "Cadeaux d'entreprise · Édition limitée",
    titleLead: 'Des cadeaux aux couleurs',
    titleJoin: 'de ',
    titleAccent: 'votre entreprise',
    subtitle:
      "Une collection d'objets personnalisables — médaillons, boules et supports de téléphone — pensée pour marquer la fin d'année avec élégance et authenticité régionale.",
    cta: 'Découvrir les cadeaux',
  },

  products: {
    eyebrow: 'Nos idées cadeaux',
    title: 'Des objets qui font sens',
    intro:
      'Chaque pièce est pensée pour durer, gravée à votre image et fabriquée en matériaux nobles ou recyclés, en lien direct avec le territoire alsacien.',
    items: [
      {
        slug: 'medaillon-diorama',
        name: 'Médaillon « Diorama forestier »',
        description:
          'Boule de Noël aplatie en bois clair, scène en couches découpées au laser — renards, feuillages et baies.',
        provenance: 'Bois clair découpé au laser · gravure personnalisable',
        image: medaillonDiorama,
        alt: 'Médaillon de Noël en bois clair avec scène forestière en couches : renards, feuillages et baies rouges',
        tag: 'Personnalisable',
      },
      {
        slug: 'etoiles-forestieres',
        name: 'Étoiles forestières — Lot de 4',
        description:
          'Quatre étoiles à suspendre en bois clair, silhouettes découpées au laser : cerf, renard, loup et ours.',
        provenance: 'Bois clair · découpe laser, motifs personnalisables',
        image: etoilesForestieres,
        alt: 'Lot de quatre étoiles de Noël en bois clair découpé au laser avec scènes forestières : cerf, renard, loup et ours',
        tag: 'Personnalisable',
      },
      {
        slug: 'support-telephone',
        name: 'Support téléphone bois & marbre',
        description:
          'Base en chêne clair, panneau résine marbrée, gravure logo au laser. Disponible également en plastique recyclé.',
        provenance: 'Chêne local · variante plastique recyclé disponible',
        image: supportTelephone,
        alt: 'Support de téléphone en bois clair avec panneau en résine marbrée blanc et bleu, gravure ALSACE LAIT sur la base',
        tag: 'Personnalisable',
      },
      {
        slug: 'medaillon-bouteille',
        name: 'Médaillon « Bouteille & sapin »',
        description:
          'Disque en bois clair gravé : sapin, bouteille de lait et logo, cordon rayé rouge et blanc.',
        provenance: 'Bois clair gravé au laser · motif personnalisable',
        image: medaillonBouteille,
        alt: 'Médaillon de Noël rond en bois clair avec sapin, bouteille de lait et logo Alsace Lait gravés, cordon rayé rouge et blanc',
        tag: 'Personnalisable',
      },
      {
        slug: 'collection-medaillons',
        name: 'Collection médaillons alsaciens',
        description:
          'Ensemble de trois disques en bois : scène de ferme, vache tachetée et médaillon marbre gravé.',
        provenance: 'Bois & marbre · assemblage artisanal alsacien',
        image: collectionMedaillons,
        alt: 'Collection de trois médaillons de Noël en bois clair avec scènes de ferme alsacienne, vache tachetée et disque marbre gravé Alsace Lait',
        tag: 'Personnalisable',
      },
      {
        slug: 'coeur-frohe-weihnachten',
        name: 'Cœur « Frohe Weihnachten »',
        description:
          "Cœur en bois clair, bouteille de lait découpée et message de saison gravé. Idéal pour vos vœux d'entreprise.",
        provenance: 'Bois clair · message personnalisable au laser',
        image: coeurAlsacien,
        alt: 'Cœur de Noël en bois clair avec silhouette de bouteille de lait découpée et texte Frohe Weihnachten gravé, suspendu à une branche de sapin enneigée',
        tag: 'Personnalisable',
      },
    ],
  },

  gallery: {
    eyebrow: 'Galerie',
    title: 'La collection en images',
    intro:
      'Un aperçu des pièces gravées et de leur mise en scène — chaque objet est unique, gravé à votre image.',
    photos: [
      {
        image: medaillonDiorama,
        alt: 'Médaillon de Noël suspendu dans un sapin, scène de renards en bois découpé',
      },
      {
        image: etoilesForestieres,
        alt: 'Quatre étoiles de Noël en bois clair avec scènes forestières',
      },
      {
        image: supportTelephone,
        alt: 'Support de téléphone en bois avec gravure ALSACE LAIT',
      },
      {
        image: medaillonBouteille,
        alt: 'Médaillon rond en bois avec sapin et bouteille de lait gravés',
      },
      {
        image: collectionMedaillons,
        alt: 'Collection de médaillons de Noël en bois sur planche',
      },
      {
        image: coeurAlsacien,
        alt: 'Cœur de Noël en bois suspendu à un sapin enneigé',
      },
    ],
  },

  values: [
    {
      icon: 'origin',
      title: 'Fabriqué en Alsace',
      text: 'Bois local, découpe laser et assemblage dans nos ateliers.',
    },
    {
      icon: 'engrave',
      title: 'À votre image',
      text: 'Chaque pièce est gravée au logo et aux couleurs de votre entreprise.',
    },
    {
      icon: 'clock',
      title: 'Devis sous 48h',
      text: 'Une réponse rapide, gratuite et sans engagement.',
    },
    {
      icon: 'gift',
      title: 'Échantillon sur demande',
      text: 'Recevez une pièce avant de valider votre commande.',
    },
  ],

  contact: {
    eyebrow: 'Prenons contact',
    title: 'Offrez un Noël qui vous ressemble',
    intro: 'Dites-nous ce qui vous plaît, on vous envoie un devis sous 48h.',
    lead: "Sélectionnez vos pièces, on s'occupe du reste : devis personnalisé, gravure à votre logo et livraison depuis l'Alsace.",
    reassurance: ['Devis gratuit', 'Sans engagement', 'Fabriqué en Alsace'],
    person: {
      name: 'Nicolas JEROME',
      role: 'Fondateur Réusit',
      email: 'nicolas@reusit.fr',
      phone: '+33 3 88 00 00 00',
      phoneHref: '+33388000000',
    },
  },

  form: {
    netlifyName: 'devis',
    quantityDefault: 25,
    consent:
      "J'accepte que Réusit traite mes données pour répondre à ma demande de devis.",
    submit: 'Recevoir mon devis',
    note: 'Devis gratuit · réponse sous 48h · sans engagement',
    success: {
      eyebrow: 'Merci',
      title: 'Votre demande a bien été envoyée',
      text: 'Notre équipe vous répondra sous 48 heures. Une question urgente ? Écrivez-nous à',
    },
  },

  footer: {
    agency: 'Réusit',
    line: "Cadeaux d'entreprise personnalisés",
    year: '© 2026',
  },

  personalization: {
    metaTitle: "Cadeaux d'entreprise — {nom}",
    metaDescription:
      "Collection de cadeaux d'entreprise personnalisables, gravés au logo {nom}. Fabriqués en Alsace par Réusit.",
    heroLead: 'Noël aux couleurs',
    heroJoin: "d'",
    contactTitle: 'Offrez un Noël aux couleurs de {nom}',
    footerLine: 'Une collection réalisée pour {nom}',
  },
};
