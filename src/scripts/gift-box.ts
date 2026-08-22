/**
 * Coffret du hero : ouverture au défilement, gerbe de confettis, puis
 * passation à la boule.
 *
 * Le hero fusionné fait 250vh et épingle son contenu : la progression y est
 * mesurée sur le rectangle de la section, comme dans l'îlot 3D — même
 * formule, pour que les seuils tombent au même endroit. L'écouteur pose deux
 * classes : `is-open` sur le coffret (le couvercle se soulève, puis les
 * confettis), puis `is-swapped` sur la section (le coffret s'efface pendant
 * que la boule apparaît — le fondu croisé vit dans global.css). Aucun état
 * caché n'est posé ailleurs que depuis ici : sans JavaScript, tout reste
 * visible. Revenir tout en haut réarme les deux.
 *
 * Les confettis vivent dans un calque `position: fixed` retiré du DOM à la
 * fin, et ne captent jamais les clics.
 */

const CONFETTI_COUNT = 44;
const FALL_MS = 2600;

/**
 * Seuil d'ouverture : proportion de la section déjà défilée. Volontairement
 * bas, pour que le coffret soit encore bien dans l'écran au moment de la
 * gerbe.
 */
const OPEN_RATIO = 0.05;

/**
 * Seuil de passation coffret → boule : la transition CSS se joue pendant que
 * le défilement parcourt 0,12 → 0,22, et le désassemblage 3D ne démarre
 * qu'à 0,22 (SEQUENCE_START dans BaubleCanvas.tsx) — la boule est posée
 * juste avant que ses plaques ne bougent.
 */
const SWAP_RATIO = 0.12;

/** Hero court (client sans boule, pas d'épinglage) : seuil historique. */
const SHORT_RATIO = 0.16;

function colors(): string[] {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return [
    read('--c-accent', '#D32F2F'),
    read('--c-gold', '#C5A059'),
    read('--c-heading', '#1A2C5E'),
    '#FFFFFF',
  ];
}

/**
 * Fait jaillir les confettis depuis le coffret puis les laisse retomber.
 * Le calque se supprime seul ; rien à nettoyer côté appelant.
 */
function burst(origin: DOMRect) {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);

  const palette = colors();
  const startX = origin.left + origin.width / 2;
  const startY = origin.top + origin.height * 0.3;

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.background = palette[i % palette.length];
    piece.style.left = `${startX}px`;
    piece.style.top = `${startY}px`;
    // Deux formats : rectangles et disques, pour varier la silhouette.
    if (i % 3 === 0) piece.style.borderRadius = '50%';
    layer.appendChild(piece);

    // Éventail vers le haut, puis chute au-delà du bas de l'écran.
    const angle = (-90 + (i / CONFETTI_COUNT) * 150 - 75) * (Math.PI / 180);
    const power = 170 + (i % 7) * 30;
    const peakX = Math.cos(angle) * power;
    // La gerbe ne doit pas dépasser le haut de l'écran, sinon on ne la voit pas.
    const maxRise = Math.max(60, startY - 70);
    const peakY = Math.max(Math.sin(angle) * power, -maxRise);
    const driftX = peakX * 2.1;
    const fallY = window.innerHeight - startY + 140;
    const spin = (i % 2 === 0 ? 1 : -1) * (360 + (i % 5) * 180);

    piece.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1, offset: 0 },
        {
          transform: `translate(calc(-50% + ${peakX}px), calc(-50% + ${peakY}px)) rotate(${spin * 0.35}deg)`,
          opacity: 1,
          offset: 0.28,
        },
        {
          transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${fallY}px)) rotate(${spin}deg)`,
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: FALL_MS + (i % 6) * 180,
        delay: (i % 9) * 26,
        easing: 'cubic-bezier(0.25, 0.6, 0.4, 1)',
        fill: 'forwards',
      }
    );
  }

  window.setTimeout(() => layer.remove(), FALL_MS + 1400);
}

/** Progression de la section épinglée : 0 en haut, 1 quand elle quitte l'écran. */
function sectionProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return 0;
  const p = -rect.top / travel;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

export function initGiftBox(): void {
  const gift = document.querySelector<HTMLElement>('[data-gift]');
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!gift || !hero) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('animate' in Element.prototype)) {
    // Coffret présenté ouvert, sans mouvement ni confettis.
    gift.classList.add('is-open', 'is-static');
    return;
  }

  // Sans boule déclarée, le hero garde sa hauteur naturelle : la progression
  // se mesure alors au scrollY, comme avant la fusion.
  const pinned = hero.hasAttribute('data-bauble');

  let opened = false;
  let swapped = false;

  const onScroll = () => {
    const progress = pinned
      ? sectionProgress(hero)
      : window.scrollY / Math.max(hero.offsetHeight, 1);

    if (!opened && progress > (pinned ? OPEN_RATIO : SHORT_RATIO)) {
      opened = true;
      gift.classList.add('is-open');
      // Laisse le couvercle se soulever avant de libérer les confettis.
      window.setTimeout(() => burst(gift.getBoundingClientRect()), 260);
    }

    if (pinned && !swapped && progress >= SWAP_RATIO) {
      swapped = true;
      hero.classList.add('is-swapped');
    }

    // Retour tout en haut : le coffret se referme et la scène peut rejouer.
    if (opened && window.scrollY < 40) {
      opened = false;
      swapped = false;
      gift.classList.remove('is-open');
      hero.classList.remove('is-swapped');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
