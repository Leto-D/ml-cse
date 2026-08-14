/**
 * Coffret du hero : ouverture au défilement et pluie de confettis.
 *
 * Déclenché une fois quand le hero est suffisamment sorti de l'écran. Les
 * confettis vivent dans un calque `position: fixed` retiré du DOM à la fin, et
 * ne captent jamais les clics. Revenir tout en haut réarme l'animation.
 */

const CONFETTI_COUNT = 44;
const FALL_MS = 2600;

/**
 * Seuil de déclenchement : proportion du hero déjà défilée. Volontairement bas,
 * pour que le coffret soit encore bien dans l'écran au moment de la gerbe.
 */
const TRIGGER_RATIO = 0.16;

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

  let opened = false;

  const onScroll = () => {
    const progress = window.scrollY / Math.max(hero.offsetHeight, 1);

    if (!opened && progress > TRIGGER_RATIO) {
      opened = true;
      gift.classList.add('is-open');
      // Laisse le couvercle se soulever avant de libérer les confettis.
      window.setTimeout(() => burst(gift.getBoundingClientRect()), 260);
      return;
    }

    // Retour tout en haut : le coffret se referme et pourra rejouer.
    if (opened && window.scrollY < 40) {
      opened = false;
      gift.classList.remove('is-open');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
