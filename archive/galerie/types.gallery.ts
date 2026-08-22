/*
 * Clés retirées de src/types.ts lors du retrait de la galerie (chantier B).
 * Pour restaurer : recopier l'interface GalleryPhoto et la clé `gallery`
 * dans l'interface Client, à l'emplacement qu'occupait `gallery`
 * (entre `products` et `values`).
 */

import type { ImageMetadata } from 'astro';

export interface GalleryPhoto {
  image: ImageMetadata;
  alt: string;
}

/** À réintégrer dans l'interface Client : */
export type GalleryKey = {
  gallery: {
    eyebrow: string;
    title: string;
    intro: string;
    photos: GalleryPhoto[];
  };
};
