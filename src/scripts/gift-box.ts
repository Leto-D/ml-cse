/**
 * Coffret du hero : ouverture au défilement.
 *
 * L'ouverture est calée sur l'arrivée du titre de la section suivante, pas sur
 * un pourcentage du hero : c'est lui que les confettis vont dessiner, il doit
 * donc être à l'écran au moment où ils se posent. Le coffret, lui, est encore
 * visible à cet instant sur toutes les tailles d'écran.
 *
 * La gerbe et sa recomposition en titre sont confiées à confetti-morph.
 * Revenir tout en haut réarme l'animation.
 */

import { playConfettiMorph } from './confetti-morph';

/** Le titre doit avoir franchi cette fraction de la hauteur d'écran. */
const TRIGGER_VIEWPORT_RATIO = 0.85;

/** Repli si le titre est introuvable : proportion du hero défilée. */
const FALLBACK_HERO_RATIO = 0.16;

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
  const eyebrow = header?.querySelector<HTMLElement>('.section-eyebrow') ?? null;
  const title = header?.querySelector<HTMLElement>('h2') ?? null;

  let opened = false;

  const shouldOpen = () => {
    if (header) {
      return header.getBoundingClientRect().top < window.innerHeight * TRIGGER_VIEWPORT_RATIO;
    }
    return window.scrollY / Math.max(hero.offsetHeight, 1) > FALLBACK_HERO_RATIO;
  };

  const release = () => {
    if (!header || !eyebrow || !title) return;

    const rect = gift.getBoundingClientRect();
    // Si le coffret a quitté l'écran, la gerbe part du haut : les confettis
    // semblent alors tomber de plus haut, ce qui reste cohérent.
    const origin =
      rect.bottom > 0 && rect.top < window.innerHeight
        ? rect
        : new DOMRect(window.innerWidth / 2, 0, 0, 0);

    // Les cibles sont relevées sur le texte rendu : tant que Playfair et Inter
    // ne sont pas chargées, les glyphes mesurés seraient ceux des polices de
    // repli et les lettres tomberaient à côté.
    const start = () => playConfettiMorph(origin, header, [eyebrow, title]);
    if (document.fonts?.status === 'loaded') start();
    else document.fonts.ready.then(start);
  };

  const onScroll = () => {
    if (!opened && shouldOpen()) {
      opened = true;
      gift.classList.add('is-open');
      // Laisse le couvercle se soulever avant de libérer les confettis.
      window.setTimeout(release, 260);
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
