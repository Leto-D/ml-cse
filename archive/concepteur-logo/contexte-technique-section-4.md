/* Section retirée de CONTEXTE-TECHNIQUE.md lors du retrait du concepteur
   de logo (chantier C). Elle documentait la page /lab/logo, ses mécanismes
   et ses garde-fous : à relire avant toute restauration. */

## 4. La page « Votre logo sur l'objet »

`src/pages/lab/logo.astro` + `src/scripts/logo-preview.ts`. Accessible depuis
le second bouton du hero, sous `/lab/logo`.

Le visiteur cherche son entreprise, le logo est récupéré chez **Brandfetch**,
puis affiché dans une zone déplaçable sur une photo produit. Trois réglages :
version du logo (logo / symbole / icône), déclinaison (claire / sombre),
technique de marquage (encré / gravé / gaufré).

Mécanismes à connaître :

- **Aucun `fetch` pour l'aperçu.** L'URL du CDN est posée dans un `<img>` ; le
  segment `fallback/404` force un vrai 404, capté par `onerror`. Pas de
  dépendance CORS, et surtout pas de succès simulé.
- **La technique de marquage est purement CSS**, donc gratuite en réseau.
  Changer de technique ne déclenche aucune requête ; changer de version ou de
  déclinaison relance l'aperçu automatiquement, dès lors qu'un logo est déjà
  affiché.
- **Le relief vient de copies décalées.** Le script pose l'URL du logo dans
  `--logo-url` sur `.logo-mark` ; deux pseudo-éléments reprennent cette image,
  décalée d'un ou deux pixels, **sous** le logo. Seule la frange qui dépasse
  reste visible : lèvre claire pour la gravure, ombre portée pour le gaufrage.
- **Rien ne doit isoler le marquage de la photo.** Un `mix-blend-mode` ne
  fusionne qu'avec ce qui est peint dans son contexte d'empilement. La zone
  était centrée par `transform: translate(-50%, -50%)`, ce qui en créait un :
  toutes les fusions étaient inertes, et le marquage se posait comme un
  autocollant. La zone est donc positionnée **par son coin haut-gauche**, le
  script convertissant le centre logique en coin à chaque pose (d'où la
  fonction `refresh` et l'écoute du `resize`). Ne jamais réintroduire de
  `transform`, `filter`, `opacity < 1` ou `isolation: isolate` sur
  `.logo-zone` ou `.logo-mark` : chacun rétablirait le bug.
- **Le fond plein est détouré au canevas.** `knockoutBackground()` échantillonne
  le pourtour ; s'il est opaque et uniforme, un remplissage par diffusion depuis
  les bords rend cette couleur transparente, avec une frange adoucie. Jamais un
  remplacement global : un aplat de la même couleur à l'intérieur du tracé doit
  survivre. La fonction renvoie `null` (et on affiche l'image brute) si le fond
  n'est pas uniforme, si le canevas est contaminé faute d'en-têtes CORS, ou si
  plus de 97 % de l'image disparaît. Le logo est chargé une première fois avec
  `crossOrigin`, et réessayé sans en cas d'échec : un refus CORS ne prouve pas
  que le logo n'existe pas.
- **Deux réglages ont un piège de vocabulaire.** La version « logo » est le
  défaut parce que Brandfetch la livre en fond transparent ; `icon` est une
  vignette carrée à fond plein. Et le paramètre `theme` désigne la couleur du
  **tracé**, pas celle du support : `dark` (tracé foncé) est le défaut, puisque
  les objets sont clairs. `light` renvoie souvent un tracé blanc, qui disparaît
  entièrement sous un `multiply`.
- **Repli automatique de version.** Toutes les marques n'ont pas les trois
  versions. Si celle demandée renvoie 404, le script parcourt les autres dans
  l'ordre `logo → symbole → icône`, affiche la première disponible et **bascule
  le bouton** dessus en l'annonçant. Le visiteur n'a donc jamais à les essayer
  une par une. Un jeton `previewToken` garantit que seul le dernier aperçu
  demandé s'affiche, les chaînes de repli étant asynchrones.
- **`data-cut` sur la zone** signale un logo détouré. En mode « Encré », le
  `multiply` n'est appliqué qu'en son absence : sur un tracé clair détouré, il
  effacerait le marquage.

Pièges :

- Les suggestions de recherche sont **créées en JavaScript**, donc elles ne
  portent pas l'attribut de scope d'Astro. Toute règle qui les vise doit
  passer par `:global()`, sinon elle ne s'applique jamais. Même chose pour le
  `<img>` du logo. `.logo-mark`, lui, est dans le markup : il reste scopé, et
  c'est exprès, pour que ses pseudo-éléments fonctionnent.
- Le **client ID Brandfetch** vient de `CLIENTBRANDFETCH` (ou
  `PUBLIC_CLIENTBRANDFETCH`) dans `.env`. Il est encodé en base64 dans
  `data-cid` sur le formulaire, donc absent en clair du HTML et du bundle.
  **Ce n'est pas une protection**, seulement un obstacle aux aspirateurs
  naïfs.

### Garde-fous de consommation

`allow()` dans `logo-preview.ts` tient un compteur par heure glissante dans
`localStorage` : 160 recherches, 120 aperçus. Le comptage est **par navigateur**,
pas par adresse IP ni par compte : `localStorage` est cloisonné par origine et
par profil. Changer de navigateur, passer en navigation privée ou vider le
stockage remet le compteur à zéro. S'y ajoutent trois caractères minimum avant
de chercher, 400 ms d'anti-rebond, la balise `noindex` et un `robots.txt`
interdisant `/lab/`.

Un repli de version peut déclencher jusqu'à trois requêtes image pour un seul
aperçu, mais ne consomme qu'un jeton : c'est la même demande du visiteur.

Tout cela protège du clic frénétique et de l'onglet oublié. **Aucun de ces
garde-fous n'arrête un robot** : ils vivent dans le navigateur, et le
`robots.txt` du dépôt n'a même pas autorité sur GitHub Pages, où le site est
servi sous `/ml-cse` et non à la racine du domaine. La seule protection réelle
serait un proxy détenant la clé côté serveur (fonction Netlify ou Cloudflare
Worker), la page appelant ce proxy au lieu de Brandfetch.
