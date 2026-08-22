# Archives

Ce dossier recueille ce qui a été retiré de la landing. Astro ne construit que
`src/pages/` et `tsconfig.json` l'exclut de la vérification de types : y ranger
un fichier ne casse ni le build ni `astro check`. Rien n'est perdu — tout est
là pour être relu, puis remis si le besoin revient.

---

## `galerie/` — la section « La collection en images »

**Ce que c'était.** Une mosaïque de six photos (`Gallery.astro`), trois
empreintes alternées (haute, large, petite) sur une grille de six colonnes,
chaque vignette ouvrant une visionneuse plein écran (`lightbox.ts`) avec
navigation clavier et légendes.

**Pourquoi c'est sorti.** Les six photos étaient exactement celles des fiches
produits (`gallery.photos` et `products.items` pointaient sur les mêmes imports
`galerie-1..6.jpg`) : la section réaffirmait la même chose une page plus bas,
sans information nouvelle. Retirée pour raccourcir la page, sur décision du
commanditaire (mission « resserrer le haut de la landing », 2026-08-22).

**Le retrait.** Sorti par le commit qui fusionne l'ouverture du hero, sur la
branche `feat/boule-3d`. Les fichiers déplacés ici conservent leur historique
Git : `git log --follow archive/galerie/Gallery.astro` remonte avant le
déplacement.

**Contenu :**

| Fichier | Rôle d'origine |
|---|---|
| `Gallery.astro` | La section et sa mosaïque |
| `lightbox.ts` | La visionneuse plein écran |
| `global.gallery.css` | Les blocs `GALERIE` et `VISIONNEUSE` de `global.css`, plus les fragments des blocs `RESPONSIVE` et `ACCESSIBILITÉ`, tels quels |
| `alsace-lait.gallery.ts` | Le bloc `gallery` de la config client |
| `types.gallery.ts` | `GalleryPhoto` et la clé `gallery` de `Client` |

**Pour remettre :**

1. Déplacer `Gallery.astro` vers `src/components/` et `lightbox.ts` vers
   `src/scripts/`.
2. Réinjecter le contenu de `global.gallery.css` dans `src/styles/global.css` :
   les deux premiers blocs après la section `PRODUITS`, chaque fragment
   responsive dans le media query indiqué dans le fichier.
3. Rétablir `GalleryPhoto` et la clé `gallery` dans `src/types.ts` (entre
   `products` et `values`) — voir `types.gallery.ts`.
4. Réintégrer le bloc `gallery` dans `src/clients/alsace-lait.ts` (entre
   `products` et `values`), les imports d'images `galerie-1..6.jpg` étant
   restés dans le fichier.
5. Réajouter `.gallery-mosaic` à la liste des cibles de `src/scripts/reveal.ts`.
6. Remettre `<Gallery client={client} />` dans `src/pages/index.astro`, entre
   `<Products>` et `<Values>`.

Les images `src/assets/galerie-*.jpg` ne sont jamais parties : les fiches
produits les utilisent.

---

## `concepteur-logo/` — la page « Votre logo sur l'objet » (`/lab/logo`)

**Ce que c'était.** Un simulateur : le visiteur cherchait son entreprise, le
logo était récupéré chez Brandfetch, puis affiché déplaçable sur une photo
produit avec trois réglages (version, déclinaison, technique de marquage).
Page de 740 lignes (`logo.astro`, styles compris), script de 671 lignes
(`logo-preview.ts`), accessible depuis le second bouton du hero.

**Pourquoi c'est sorti.** Le haut de la landing devait être resserré : le hero
n'a plus qu'un appel à l'action, et le simulateur interrogeait une API tierce à
quota sans protection réelle côté serveur (voir
`contexte-technique-section-4.md`, « Garde-fous de consommation »). Retiré sur
décision du commanditaire (même mission, 2026-08-22).

**Le retrait.** Même commit que la galerie (voir plus haut).

**Contenu :**

| Fichier | Rôle d'origine |
|---|---|
| `logo.astro` | La page `/lab/logo` (structure, styles scopés, réglages) |
| `logo-preview.ts` | Recherche Brandfetch, détourage, placement, rendus |
| `coeur_vache_placeholder.png` | Photo produit de la zone d'aperçu (aucun autre usage — vérifié) |
| `contexte-technique-section-4.md` | La section 4 de `CONTEXTE-TECHNIQUE.md` : mécanismes, pièges, garde-fous |

**Pour remettre :**

1. Déplacer `logo.astro` vers `src/pages/lab/logo.astro` (créer `src/pages/lab/`),
   `logo-preview.ts` vers `src/scripts/` et `coeur_vache_placeholder.png`
   vers `src/placeholders/` (à créer).
2. Réintégrer la section 4 dans `CONTEXTE-TECHNIQUE.md`, entre les sections 3
   et 5.
3. Remettre un `ctaSecondary` dans `hero` de la config client — le rendu
   conditionnel est resté dans `Hero.astro` et la clé optionnelle dans
   `types.ts` :
   ```ts
   ctaSecondary: { label: 'Votre logo', href: 'lab/logo' },
   ```
4. Rétablir la variable de build dans `.github/workflows/deploy.yml` (étape
   « Construire le site ») :
   ```yaml
   env:
     PUBLIC_CLIENTBRANDFETCH: ${{ vars.PUBLIC_CLIENTBRANDFETCH }}
   ```
5. Redéfinir la variable côté dépôt : `gh variable set PUBLIC_CLIENTBRANDFETCH
   --repo Leto-D/ml-cse --body "…"`, et les lignes `APIBRANDFETCH` /
   `CLIENTBRANDFETCH` du `.env` local si les tests hors build sont rejoués.

Les styles de la page étaient tous scopés dans `logo.astro` : rien à
réinjecter dans `global.css`. `MultiSelect.astro`, `multiselect.ts` et
`personalize.ts` ne sont PAS concernés : ils servent au formulaire de devis et
à la personnalisation d'URL, ils sont restés en place.
