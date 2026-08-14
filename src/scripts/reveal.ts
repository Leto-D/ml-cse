/**
 * Apparition au scroll + défilement doux des ancres.
 * Sous prefers-reduced-motion, tout est affiché immédiatement.
 */

export function initMotion(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll<HTMLElement>('.reveal, .stagger, .gallery-mosaic');

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((el) => observer.observe(el));
  }

  // Le CSS gère déjà scroll-padding-top ; ce handler ne sert qu'au retour en haut.
  document.querySelectorAll<HTMLAnchorElement>('a[href="#top"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  });
}
