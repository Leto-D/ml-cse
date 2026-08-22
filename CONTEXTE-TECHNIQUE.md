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
ce dont une landing a besoin : `palette`, `meta`, `header`, `hero`
(`bauble` en clé optionnelle), `products`, `values`, `contact`, `form`,
`footer`, `personalization`. Un nouveau client doit satisfaire cette interface,
sinon le build TypeScript échoue. C'est volontaire : le contrat est la
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

### L'ouverture fusionnée

Le hero et l'ancienne section boule n'en font qu'une : une section de 250vh
(200vh sous 960px) portant `data-bauble`, dont le contenu vit dans un étage
`sticky` de `100svh`. Le coffret s'ouvre à 5 % de défilement, s'efface à 12 %
pendant que la boule apparaît (fondu croisé en CSS, classes posées par
`gift-box.ts`), et le désassemblage 3D ne démarre qu'à 22 %
(`SEQUENCE_START` dans `BaubleCanvas.tsx`). Un client sans clé `bauble` garde
un hero classique, non épinglé.

Ce qui a quitté la page (galerie, page « Votre logo ») est archivé à la
racine dans `archive/`, avec un README qui dit comment le remettre.

---

## 3. Le JavaScript

Chaque module de `src/scripts/` est importé par un `<script>` du composant qui
le concerne ; Astro les regroupe en îlots et ne charge rien d'autre. La page
d'accueil en sert quelques **kilo-octets** ; le morceau lourd de la scène 3D
(React + three, ~1,1 Mo) n'est tiré que si le mouvement est autorisé, que WebGL
répond et que le hero approche.

| Module | Rôle |
|---|---|
| `multiselect.ts` | Liste déroulante à choix multiples posée sur de vraies cases à cocher |
| `quote-form.ts` | Compteur de quantité, présélection produit, mode démonstration, envoi |
| `letter-animation.ts` | Enveloppe de Noël qui s'envole au clic sur « Envoyer » (~1,45 s, WAAPI) |
| `reveal.ts` | Apparition des sections au défilement (`IntersectionObserver`) |
| `personalize.ts` | Réécritures liées au paramètre `?nom=` |
| `gift-box.ts` | L'ouverture du hero : couvercle du coffret + 44 confettis, puis passation à la boule |
| `bauble.ts` | Garde d'entrée de la scène 3D : ne tire le morceau lourd que si le mouvement est autorisé, WebGL répond et le hero approche |

### Point important sur `multiselect.ts`

L'état vit dans les `<input type="checkbox">` natifs. Le script ne fait que
**refléter** cet état dans l'interface. Il n'y a pas d'état applicatif en
JavaScript à synchroniser. Le formulaire fonctionne donc sans JavaScript, et
le clavier est géré complètement : ArrowDown/Enter/Space ouvre, les flèches et
Home/End naviguent, Escape ferme et rend le focus au bouton.

### Point important sur `gift-box.ts`

Le hero fusionné (coffret puis boule, une seule section de 250vh épinglée)
déroule son scénario sur la progression de la section : le couvercle s'ouvre à
`OPEN_RATIO = 0,05`, et la passation — le coffret s'efface pendant que la boule
apparaît, tout en transitions CSS — se déclenche à `SWAP_RATIO = 0,12`. La
hauteur défilable étant 1,5 écran, un seuil d'ouverture plus haut laisserait le
coffret trop près du bord supérieur et la gerbe partirait hors écran. Pour la
même raison, la hauteur du jet est bornée :

```ts
const maxRise = Math.max(60, startY - 70);
const peakY = Math.max(Math.sin(angle) * power, -maxRise);
```

Les confettis vivent dans un calque `position: fixed`, `pointer-events: none`,
supprimé du DOM à la fin. Revenir tout en haut réarme l'ouverture ET la
passation. `prefers-reduced-motion` présente le coffret ouvert, immobile, sans
confettis, les figures SVG de la boule empilées dessous — et la scène 3D n'est
jamais chargée.

**Ne pas réintroduire** : plusieurs versions plus ambitieuses ont été
construites puis abandonnées sur décision du client — recomposition des
confettis en lettres du titre, puis en boule de Noël, avec défilement
d'accompagnement. Rendu jugé illisible. Les modules `confetti-morph.ts`,
`confetti-bauble.ts` et `scroll-assist.ts` ont été supprimés. Le comportement
attendu aujourd'hui est simple : les confettis apparaissent et disparaissent.

---

## 4. Le formulaire de devis

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

## 5. Déploiement

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

## 6. Pièges déjà rencontrés

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

## 7. Commandes

```bash
npm run dev      # serveur de développement
npm run check    # astro check — doit rester à 0 erreur, 0 avertissement
npm run build    # génère dist/
```

`npm run check` était propre au dernier état connu ; le garder ainsi.
