// @ts-check
import { defineConfig } from 'astro/config';

// Site statique : chaque landing est générée au build, aucun runtime serveur.
// Netlify Forms détecte le <form> dans le HTML produit — pas d'adaptateur requis.
export default defineConfig({
  site: 'https://reusit.fr',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Formats servis par <Picture> : AVIF puis WebP, repli JPEG.
    responsiveStyles: true,
  },
});
