# Contexte technique — Réusit × Alsace Lait

Document de passation destiné à un agent IA qui devra répondre à des questions
techniques sur ce projet sans avoir participé à sa construction.

---

## 1. Ce qu'est le projet

Une landing page unique (one-page) présentant une collection de cadeaux
d'entreprise de Noël gravés, réalisée par l'agence Réusit pour le client
Alsace Lait. Objectif de la page : amener le visiteur à remplir un formulaire
de demande de devis.

Le site a été refondu sous **Astro 5.18** avec une contrainte structurante :
il doit servir de **template multi-clients**. Aucun texte, aucune couleur,
aucune image n'est écrite dans un composant. Tout vient d'un objet de
configuration. Rhabiller le site pour un autre client, c'est écrire un
fichier de config, pas toucher au code.

Deuxième principe directeur : « élever l'existant ». La direction artistique
d'origine (bleu nuit, rouge, or) a été conservée et raffinée, pas remplacée.

---

## 2. Architecture

### Le contrat de données

`src/types.ts` définit l'interface `Client`. C'est le seul endroit qui décrit
ce dont une landing a besoin : `palette`, `meta`, `header`, `hero`,
`products`, `gallery`, `values`, `contact`, `form`, `footer`,
`personalization`. Un nouveau client doit satisfaire cette interface, sinon
le build TypeScript échoue. C'est volontaire : le contrat est la
documentation.

### La sélection du client

`src/clients/index.ts` tient un registre :

```ts
export const clients = { 'alsace-lait': alsaceLait } satisfies Record<string, Client>;
export const activeClient: Client = resolve(import.meta.env.CLIENT);
```

Le client actif est choisi au moment du build via la variable d'environnement
`CLIENT`. Un identifiant inconnu **n'arrête pas le build** : il émet un
avertissement en console et retombe sur `alsace-lait`. Choix assumé, pour
qu'une faute de frappe dans une commande de déploiement ne casse pas une mise
en production.

### La palette

`src/layouts/BaseLayout.astro` est le seul point où la palette devient du CSS.
Il injecte six propriétés personnalisées sur `:root` :

```
--c-heading  --c-accent  --c-accent-dark  --c-gold  --c-bg  --c-surface
```

Toutes les couleurs de `src/styles/global.css` dérivent de ces six variables,
souvent via `color-mix(in srgb, …)`. Conséquence pratique : **modifier la
palette d'un client ne demande aucune retouche CSS**.

### Les images

Importées statiquement dans la config du client, donc traitées par
`astro:assets` (`<Picture>`, `getImage`) : formats modernes, tailles
multiples, dimensions posées dans le HTML. Une image référencée par une chaîne
de caractères échapperait à tout ça — à éviter.

---

## 3. Le JavaScript

Chaque module de `src/scripts/` est importé par un `<script>` du composant qui
le concerne ; Astro les regroupe en îlots et ne charge rien d'autre. La page
d'accueil en sert environ **7 Ko** ; `logo-preview.ts` n'est chargé que par la
page « Votre logo ».

| Module | Rôle |
|---|---|
| `multiselect.ts` | Liste déroulante à choix multiples posée sur de vraies cases à cocher |
| `quote-form.ts` | Compteur de quantité, présélection produit, mode démonstration, envoi |
| `letter-animation.ts` | Enveloppe de Noël qui s'envole au clic sur « Envoyer » (~1,45 s, WAAPI) |
| `lightbox.ts` | Visionneuse de la galerie |
| `reveal.ts` | Apparition des sections au défilement (`IntersectionObserver`) |
| `personalize.ts` | Réécritures liées au paramètre `?nom=` |
| `gift-box.ts` | Coffret du hero : couvercle qui se soulève + 44 confettis |
| `logo-preview.ts` | Page « Votre logo » : recherche Brandfetch, placement, rendus |

### Point important sur `multiselect.ts`

L'état vit dans les `<input type="checkbox">` natifs. Le script ne fait que
**refléter** cet état dans l'interface. Il n'y a pas d'état applicatif en
JavaScript à synchroniser. Le formulaire fonctionne donc sans JavaScript, et
le clavier est géré complètement : ArrowDown/Enter/Space ouvre, les flèches et
Home/End naviguent, Escape ferme et rend le focus au bouton.

### Point important sur `gift-box.ts`

Déclenché au défilement quand le hero est sorti à `TRIGGER_RATIO = 0.16`. Le
seuil est bas exprès : plus haut, le coffret est déjà trop près du bord
supérieur et la gerbe part hors écran. Pour la même raison, la hauteur du jet
est bornée :

```ts
const maxRise = Math.max(60, startY - 70);
const peakY = Math.max(Math.sin(angle) * power, -maxRise);
```

Les confettis vivent dans un calque `position: fixed`, `pointer-events: none`,
supprimé du DOM à la fin. Revenir tout en haut réarme l'animation.
`prefers-reduced-motion` présente le coffret ouvert, immobile, sans confettis.

**Ne pas réintroduire** : plusieurs versions plus ambitieuses ont été
construites puis abandonnées sur décision du client — recomposition des
confettis en lettres du titre, puis en boule de Noël, avec défilement
d'accompagnement. Rendu jugé illisible. Les modules `confetti-morph.ts`,
`confetti-bauble.ts` et `scroll-assist.ts` ont été supprimés. Le comportement
attendu aujourd'hui est simple : les confettis apparaissent et disparaissent.

---

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

---

## 5. Le formulaire de devis

L'envoi est intercepté en JavaScript :

1. `reportValidity()` sur le formulaire ;
2. l'animation de la lettre et la requête réseau partent **en parallèle**
   (`Promise.all`), pour que l'animation ne rallonge pas l'attente ;
3. succès → bloc de confirmation avec `role="status"` et prise de focus.

### Mode démonstration

```ts
protocol === 'file:' || hostname ∈ {localhost, 127.0.0.1} || hostname.endsWith('.github.io')
```

Dans ce cas la requête est **simulée** (900 ms) et deux bandeaux
`.demo-notice` — un avant l'envoi, un dans la confirmation — annoncent
explicitement que rien n'a été transmis. L'URL de démonstration étant
publique, un faux « votre demande a bien été envoyée » aurait pu tromper un
vrai prospect. La divulgation est délibérée, ne pas la retirer sans raison.

### Envoi réel

Netlify Forms, en détection statique : `data-netlify="true"`, champ caché
`form-name`, pot de miel `bot-field`. Cela ne fonctionne que sur un hébergement
Netlify. Le repli sans JavaScript (`?merci=1`) est intact.

---

## 6. Déploiement

Un push sur la branche `main` du dépôt **`ml-cse`** déclenche
`.github/workflows/deploy.yml` : Node 22, `npm ci`, `npm run build`,
publication de `dist/` sur GitHub Pages.

Site en ligne : **https://leto-d.github.io/ml-cse/**

### Le piège du chemin de base

Le site est servi sous le sous-chemin `/ml-cse`, d'où `base: '/ml-cse'` dans
`astro.config.mjs`. **Tout chemin absolu écrit en dur casse en production.**
Il doit passer par `import.meta.env.BASE_URL`. C'est déjà le cas du `action`
du formulaire et de l'URL du `fetch` — deux bogues réels corrigés à ce titre.

GitHub Pages doit rester en `build_type: workflow`. En mode « legacy », Pages
tente une construction Jekyll, incapable de traiter un projet Astro.

### Dépôts

Deux dépôts contiennent le même projet : `ml-cse` (public, celui qui est
déployé) et `alsace-lait-noel` (privé). Les remotes locaux sont `mlcse` et
`origin`. Question de ménage restée ouverte : lequel garder.

Git n'a **pas d'identité globale** sur cette machine. Chaque commit a été fait
avec :

```
git -c user.name="Leto-D" -c user.email="dmitri.zapalov@gmail.com" commit
```

---

## 7. Pièges déjà rencontrés

Utile pour ne pas rediagnostiquer ce qui l'a déjà été.

- **`[hidden] { display: none !important; }`** est indispensable dans
  `global.css` : `.mu-count` est en `display: inline-flex`, ce qui l'emportait
  sur l'attribut `hidden` et affichait un « 0 » permanent.
- **`.mu-item-label { text-transform: none; letter-spacing: 0; }`** neutralise
  la règle `.devis-form label { text-transform: uppercase }`, qui s'appliquait
  aux noms de produits parce que `.mu-item` est un `<label>`.
- **Scintillement du ruban du coffret** : le couvercle chevauchait le corps de
  8 unités et le ruban doré était peint deux fois avec des opacités
  différentes (0,95 et 1), d'où une bande resaturée re-rastérisée à chaque
  image. Correction : couvercle en y 68→108, corps démarrant exactement à 108,
  chevauchement nul, ruban continu et opaque, plus `will-change: transform`.
  Décaler le ruban du corps vers le bas serait une fausse solution : un espace
  apparaît dès que le couvercle s'envole.
- **`cssMinify: 'lightningcss'`** casse le build (dépendance absente). Retiré.
- **Les six images produits** pointaient vers des fichiers inexistants
  (`photos/medaillon-diorama.jpg`…) et retombaient toutes sur un dégradé. Les
  vrais fichiers sont `galerie-1..6.jpg`, remappés dans la config.
- **`define:vars` force `is:inline`**, ce qui empêche Astro de traiter le
  script. Les données de personnalisation passent donc par un
  `<script type="application/json" id="personalization-data">` lu par
  `personalize.ts`.
- **Cache navigateur** : lors des vérifications en ligne, un onglet déjà
  ouvert a montré une version obsolète. Vérifier au `curl` ou avec un
  paramètre anti-cache avant de conclure à une régression.

---

## 8. Commandes

```bash
npm run dev      # serveur de développement
npm run check    # astro check — doit rester à 0 erreur, 0 avertissement
npm run build    # génère dist/
```

`npm run check` était propre au dernier état connu ; le garder ainsi.
