/**
 * Garde d'entrée de la boule 3D.
 *
 * Ce module ne connaît ni React ni three : c'est tout l'intérêt. Il pose trois
 * questions, et ne tire le module lourd par `import()` que si les trois
 * réponses sont bonnes.
 *
 *   1. Le mouvement est-il autorisé ?  (`prefers-reduced-motion`)
 *   2. WebGL est-il disponible ?
 *   3. La section approche-t-elle de l'écran ?
 *
 * Si une seule réponse manque, rien n'est téléchargé : ni React, ni three, ni
 * la scène. Le repli statique posé dans le HTML reste simplement en place, et
 * aucune erreur n'est montrée au visiteur.
 *
 * Les données viennent d'un `<script type="application/json">`, comme les
 * gabarits de personnalisation : `define:vars` forcerait `is:inline` et
 * empêcherait Astro de traiter ce script.
 */

/** Marge d'anticipation : le module part avant que la section soit à l'écran. */
const PRELOAD_MARGIN = '400px';

interface BaubleData {
  decor: 'etoiles' | 'sapins' | 'flocons';
  logoUrl?: string;
  companyName: string;
  backEngraving: string;
  frontHasCutouts: boolean;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export function initBauble(): void {
  const section = document.querySelector<HTMLElement>('[data-bauble]');
  if (!section) return;

  const host = section.querySelector<HTMLElement>('[data-bauble-mount]');
  const raw = section.querySelector<HTMLScriptElement>('[data-bauble-props]');
  if (!host || !raw?.textContent) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!hasWebGL() || !('IntersectionObserver' in window)) return;

  let data: BaubleData;
  try {
    data = JSON.parse(raw.textContent) as BaubleData;
  } catch {
    return;
  }

  // La scène va venir : le repli se réduit à la boule fermée, qui sert de
  // poster. Sans cet attribut il reste à deux figures — l'état servi quand la
  // scène ne viendra jamais.
  section.setAttribute('data-bauble-live', '');

  const giveUp = () => section.removeAttribute('data-bauble-live');

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();

      import('~/components/bauble/mount')
        .then(({ mountBauble }) => {
          mountBauble(host, {
            ...data,
            section,
            onReady: () => section.setAttribute('data-bauble-ready', ''),
            onFail: giveUp,
          });
        })
        .catch(giveUp);
    },
    { rootMargin: PRELOAD_MARGIN },
  );
  observer.observe(section);
}
