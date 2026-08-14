/**
 * Coffret du hero : ouverture au défilement.
 *
 * Dès les premiers pixels de défilement, le couvercle se soulève et libère une
 * gerbe qui se rassemble en boule de Noël. La boule se compose à une position
 * d'écran fixe, donc toujours visible ; puis, quand elle se défait, la page
 * glisse doucement vers la section suivante, comme si l'animation y conduisait.
 *
 * Revenir tout en haut réarme la séquence.
 */

import { playConfettiBauble } from './confetti-bauble';
import { assistScroll } from './scroll-assist';

/**
 * Proportion du hero défilée avant l'ouverture. Volontairement basse : le
 * coffret doit encore être bien à l'écran quand la gerbe en sort.
 */
const TRIGGER_RATIO = 0.12;

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

  const header = document.querySelector<HTMLElement>('#produits .section-header');
  let opened = false;

  /** Amène la section suivante sous le titre, sans jamais remonter la page. */
  const glideToProducts = () => {
    if (!header) return;
    const target = window.scrollY + header.getBoundingClientRect().top - 120;
    if (target > window.scrollY) assistScroll(target, 1100);
  };

  const onScroll = () => {
    if (!opened && window.scrollY / Math.max(hero.offsetHeight, 1) > TRIGGER_RATIO) {
      opened = true;
      gift.classList.add('is-open');

      // Laisse le couvercle se soulever avant de libérer la gerbe.
      window.setTimeout(() => {
        const rect = gift.getBoundingClientRect();
        const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
        const origin = onScreen
          ? rect
          : new DOMRect(window.innerWidth / 2, 0, 0, 0);

        // La boule se compose à l'emplacement du coffret, pas au centre de
        // l'écran : elle semble sortir de la boîte, et surtout elle ne vient
        // pas se poser sur le titre ni sur le bouton quand tout est empilé.
        const center = onScreen
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };

        playConfettiBauble(origin, { center, onDissolve: glideToProducts });
      }, 300);
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
