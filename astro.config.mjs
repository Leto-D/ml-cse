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
  /*
    Pas d'intégration React : la scène 3D n'est pas un îlot Astro. Elle est
    montée à la main par scripts/bauble.ts derrière un `import()`, ce qui est
    la seule façon de ne rien télécharger sous `prefers-reduced-motion` ni
    tant que la section n'approche pas.

    @astrojs/react n'injecte son préambule Fast Refresh que sur les pages qui
    portent un îlot : l'ajouter sans en utiliser casse le serveur de
    développement (`$RefreshSig$ is not defined`). Le JSX est donc compilé par
    esbuild, d'après `jsx` / `jsxImportSource` de tsconfig.json.
  */
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    // Formats servis par <Picture> : AVIF puis WebP, repli JPEG.
    responsiveStyles: true,
  },
});
