/*
 * Bloc `gallery` retiré de src/clients/alsace-lait.ts lors du retrait de la
 * galerie (chantier B). Il référençait les mêmes imports d'images que les
 * fiches produits (`galerie-1..6.jpg`) : pour restaurer, recopier ce bloc
 * dans la config du client entre `products` et `values`, les imports
 * d'images étant restés dans le fichier.
 */
export const gallery = {
  eyebrow: 'Galerie',
  title: 'La collection en images',
  intro:
    'Un aperçu des pièces gravées et de leur mise en scène. Chaque objet est unique, gravé à votre image.',
  photos: [
    {
      image: 'medaillonDiorama /* import ~/assets/galerie-1.jpg */',
      alt: 'Médaillon de Noël suspendu dans un sapin, scène de renards en bois découpé',
    },
    {
      image: 'etoilesForestieres /* import ~/assets/galerie-2.jpg */',
      alt: 'Quatre étoiles de Noël en bois clair avec scènes forestières',
    },
    {
      image: 'supportTelephone /* import ~/assets/galerie-3.jpg */',
      alt: 'Support de téléphone en bois avec gravure ALSACE LAIT',
    },
    {
      image: 'medaillonBouteille /* import ~/assets/galerie-4.jpg */',
      alt: 'Médaillon rond en bois avec sapin et bouteille de lait gravés',
    },
    {
      image: 'collectionMedaillons /* import ~/assets/galerie-5.jpg */',
      alt: 'Collection de médaillons de Noël en bois sur planche',
    },
    {
      image: 'coeurAlsacien /* import ~/assets/galerie-6.jpg */',
      alt: 'Cœur de Noël en bois suspendu à un sapin enneigé',
    },
  ],
};
