/**
 * Défilement d'accompagnement.
 *
 * Amène la page à une position de cadrage pour qu'une animation se joue
 * entièrement dans le champ de vision.
 *
 * Le geste de l'utilisateur reste prioritaire : molette, tactile, clavier ou
 * clic interrompent immédiatement le mouvement. Confisquer le défilement,
 * même une seconde, est l'un des comportements les plus détestés du web ;
 * ici on ne fait que proposer un cadrage, jamais l'imposer.
 */

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function assistScroll(targetY: number, duration = 900): void {
  const startY = window.scrollY;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const endY = Math.max(0, Math.min(targetY, maxY));
  const distance = endY - startY;

  // Déjà bien cadré : inutile de bouger la page pour quelques pixels.
  if (Math.abs(distance) < 24) return;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    detach();
  };

  const events: [keyof WindowEventMap, EventListener][] = [
    ['wheel', cancel],
    ['touchstart', cancel],
    ['keydown', cancel],
    ['pointerdown', cancel],
  ];

  function detach() {
    events.forEach(([name, fn]) => window.removeEventListener(name, fn));
  }
  events.forEach(([name, fn]) =>
    window.addEventListener(name, fn, { passive: true })
  );

  let started: number | null = null;

  function step(now: number) {
    if (cancelled) return;
    if (started === null) started = now;

    const t = Math.min((now - started) / duration, 1);
    window.scrollTo(0, startY + distance * easeInOut(t));

    if (t < 1) requestAnimationFrame(step);
    else detach();
  }

  requestAnimationFrame(step);
}
