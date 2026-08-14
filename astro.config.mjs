// @ts-check
import { defineConfig } from 'astro/config';

// Site statique : chaque landing est générée au build, aucun runtime serveur.
// Netlify Forms détecte le <form> dans le HTML produit : pas d'adaptateur requis.
export default defineConfig({
  // Site publié sur GitHub Pages dans un sous-dossier : `base` doit
  // correspondre au nom du dépôt, sinon les liens et assets pointent à la racine.
  site: 'https://leto-d.github.io',
  base: '/ml-cse',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Formats servis par <Picture> : AVIF puis WebP, repli JPEG.
    responsiveStyles: true,
  },
});
