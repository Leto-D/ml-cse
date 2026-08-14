# Landing cadeaux d'entreprise · Réusit

Template de landing page pour la collection de cadeaux d'entreprise Réusit.
Construit avec [Astro](https://astro.build) en sortie statique, déployé sur Netlify.

Une landing = un fichier de configuration. Aucun texte, aucune couleur et aucune
image ne vit dans les composants : tout passe par `src/clients/`.

## Démarrer

```bash
npm install
npm run dev
```

Le site tourne sur http://localhost:4321.

| Commande          | Effet                                            |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Serveur de développement avec rechargement à chaud |
| `npm run build`   | Génère le site statique dans `dist/`             |
| `npm run preview` | Sert `dist/` localement                          |
| `npm run check`   | Vérifie les types et le markup                   |

## Créer la landing d'un nouveau client

1. Déposer les photos dans `src/assets/`.
2. Copier `src/clients/alsace-lait.ts` vers `src/clients/<nouveau-client>.ts`,
   puis adapter les textes, les images et `palette.accent`.
3. Enregistrer la config dans `src/clients/index.ts` :

   ```ts
   export const clients = {
     'alsace-lait': alsaceLait,
     'nouveau-client': nouveauClient,
   } satisfies Record<string, Client>;
   ```

4. Construire la landing voulue :

   ```bash
   CLIENT=nouveau-client npm run build
   ```

   Sans variable `CLIENT`, c'est `alsace-lait` qui est généré. Un identifiant
   inconnu déclenche un avertissement et un repli sur ce client par défaut.

Le type `Client` (`src/types.ts`) décrit tous les champs attendus : `npm run check`
signale ce qui manque avant même de lancer le build.

### Déployer plusieurs clients depuis ce dépôt

Créer un site Netlify par client, tous branchés sur ce dépôt, et définir
`CLIENT=<id>` dans les variables d'environnement de build de chacun.

## Personnaliser un lien de prospection

La landing lit le paramètre `?nom=` et adapte le titre, le hero, la section
contact, le pied de page et le champ « Entreprise » du formulaire :

```
https://votre-domaine.fr/?nom=Alsace%20Lait
```

Les gabarits de ces variantes vivent dans le bloc `personalization` de la config
client ; le jeton `{nom}` y est remplacé par la valeur saisie (limitée à
40 caractères). Sans paramètre, la landing reste dans sa version générique.

## Formulaire de devis

Le formulaire passe par [Netlify Forms](https://docs.netlify.com/forms/setup/) :
Netlify détecte le `<form data-netlify="true">` dans le HTML statique produit au
build, aucune configuration supplémentaire n'est requise.

- Le nom du formulaire vient de `form.netlifyName` et doit être unique par site.
- L'envoi est intercepté en JavaScript : validation native, POST en `fetch`, puis
  animation d'enveloppe pendant que la requête part.
- En local (`localhost`), aucun backend n'écoute : l'envoi est simulé pour
  pouvoir tester l'animation.
- Sans JavaScript, la soumission native reste fonctionnelle et retombe sur
  `/?merci=1`, qui affiche le message de confirmation.
- Un honeypot (`bot-field`) filtre les robots.

## Structure

```
src/
  types.ts            Contrat de données d'une landing
  clients/            Une config par client + registre
  assets/             Images sources, optimisées au build
  styles/global.css   Tokens de design et styles du site
  layouts/            Gabarit HTML, injection de la palette
  components/         Composants de section, sans contenu en dur
  scripts/            Comportements client (formulaire, animations)
  pages/index.astro   Assemblage de la page
```

## Accessibilité et performance

- Images servies en AVIF/WebP responsive via `astro:assets`, repli JPEG.
- Environ 7 Ko de JavaScript sur la page, chargés en modules.
- `prefers-reduced-motion` désactive les apparitions au scroll et l'animation
  d'envoi, qui laisse alors place à la confirmation immédiate.
- Liste déroulante navigable au clavier (flèches, Origine/Fin, Échap), cases à
  cocher natives, confirmation annoncée via `role="status"`.
