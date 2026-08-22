/**
 * Le bouton du hero : descendre au rythme de la scène.
 *
 * `scroll-behavior: smooth` laisse le navigateur choisir la durée, et il
 * choisit toujours la même, quelle que soit la distance. Depuis le haut de la
 * page, la séquence du coffret et de la boule défile donc en un éclair : on
 * arrive aux produits sans avoir rien vu. Ce module reprend la descente et
 * l'étale sur une durée proportionnelle au chemin, pour que l'animation se
 * lise avant qu'on la quitte.
 *
 * Il ne détourne jamais le défilement du visiteur. Il n'écoute ni `wheel` ni
 * `touchmove` et ne pose aucun `preventDefault` sur eux : à chaque image, il
 * compare la position réelle à celle qu'il vient d'écrire, et si les deux
 * diffèrent, c'est qu'une main est passée par là. Il s'efface alors sur
 * l'instant, sans rien annuler de ce que le visiteur a fait.
 */

/** Vitesse moyenne visée, en pixels par milliseconde. */
const RATE = 0.55;
/** Bornes de durée : assez long pour se lire, assez court pour ne pas peser. */
const MIN_MS = 1400;
const MAX_MS = 4200;
/** Écart au-delà duquel on considère que le visiteur a repris la main. */
const HAND_OVER_PX = 2;

/**
 * La page déclare `scroll-behavior: smooth`, donc un `scrollTo` nu déclenche
 * une animation du navigateur : la position réelle traîne derrière la valeur
 * écrite, et la sentinelle ci-dessous prendrait ce retard pour une reprise en
 * main. Chaque image doit donc se poser d'un coup, sans interpolation.
 */
const JUMP: ScrollToOptions = { behavior: 'instant' as ScrollBehavior };

/** Départ et arrivée adoucis, plein régime au milieu — là où la scène joue. */
function ease(t: number): number {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

/** Hauteur réservée sous l'en-tête fixe, telle que la CSS la déclare. */
function scrollPad(): number {
  const v = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function glideTo(target: number): void {
  const from = window.scrollY;
  const delta = target - from;
  if (Math.abs(delta) < 4) return;

  const ms = Math.min(MAX_MS, Math.max(MIN_MS, Math.abs(delta) / RATE));
  const t0 = performance.now();
  // Position écrite à l'image précédente : la sentinelle qui détecte la main
  // du visiteur. Null tant qu'on n'a rien écrit.
  let written: number | null = null;

  const step = (now: number) => {
    if (written !== null && Math.abs(window.scrollY - written) > HAND_OVER_PX) return;

    const t = Math.min(1, (now - t0) / ms);
    window.scrollTo({ ...JUMP, top: from + delta * ease(t) });
    written = window.scrollY;

    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export function initHeroCta(): void {
  const link = document.querySelector<HTMLAnchorElement>('.hero-actions a[href^="#"]');
  if (!link) return;

  // Mouvement réduit : on laisse le navigateur faire, il saute sans animer.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  link.addEventListener('click', (e) => {
    // Clic milieu, Cmd, Ctrl, Maj : le visiteur veut un onglet ou une fenêtre.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const hash = link.getAttribute('href') ?? '';
    const target = document.querySelector<HTMLElement>(hash);
    if (!target) return;

    e.preventDefault();

    const y = target.getBoundingClientRect().top + window.scrollY - scrollPad();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    glideTo(Math.max(0, Math.min(y, max)));

    // L'adresse suit le clic, comme l'aurait fait l'ancre.
    history.pushState(null, '', hash);
    // Et le focus aussi : sans lui, un lecteur d'écran resterait sur le bouton.
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}
