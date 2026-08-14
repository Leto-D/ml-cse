/**
 * Visionneuse de la galerie.
 *
 * Les vignettes sont des <button> : le clavier y accède nativement. À
 * l'ouverture, le focus part dans la visionneuse et revient sur la vignette
 * d'origine à la fermeture. Flèches pour naviguer, Échap pour fermer.
 */

interface Slide {
  full: string;
  alt: string;
}

const FOCUSABLE = 'button:not([disabled])';

export function initLightbox(): void {
  const gallery = document.querySelector<HTMLElement>('[data-gallery]');
  if (!gallery) return;

  const triggers = Array.from(
    gallery.querySelectorAll<HTMLButtonElement>('[data-lightbox]')
  );
  if (triggers.length === 0) return;

  const slides: Slide[] = triggers.map((trigger) => ({
    full: trigger.dataset.full ?? '',
    alt: trigger.querySelector('img')?.alt ?? '',
  }));

  let index = 0;
  let opener: HTMLButtonElement | null = null;

  // Construit une seule fois la coquille, réutilisée à chaque ouverture.
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Visionneuse de la galerie');
  overlay.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Fermer la visionneuse">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
    <button type="button" class="lightbox-nav is-prev" aria-label="Image précédente">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <figure class="lightbox-figure">
      <img alt="" />
      <figcaption></figcaption>
    </figure>
    <button type="button" class="lightbox-nav is-next" aria-label="Image suivante">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  `;
  document.body.appendChild(overlay);

  const image = overlay.querySelector('img')!;
  const caption = overlay.querySelector('figcaption')!;
  const closeBtn = overlay.querySelector<HTMLButtonElement>('.lightbox-close')!;

  function render(next: number) {
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    image.src = slide.full;
    image.alt = slide.alt;
    caption.textContent = slide.alt;
  }

  function open(at: number, trigger: HTMLButtonElement) {
    opener = trigger;
    render(at);
    overlay.hidden = false;
    // Empêche la page de défiler derrière la visionneuse.
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    closeBtn.focus();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    window.setTimeout(() => {
      overlay.hidden = true;
      image.removeAttribute('src');
    }, 200);
    opener?.focus();
    opener = null;
  }

  triggers.forEach((trigger, i) => {
    trigger.addEventListener('click', () => open(i, trigger));
  });

  closeBtn.addEventListener('click', close);
  overlay
    .querySelector('.is-prev')!
    .addEventListener('click', () => render(index - 1));
  overlay
    .querySelector('.is-next')!
    .addEventListener('click', () => render(index + 1));

  // Un clic sur le fond ferme ; un clic sur l'image ou les boutons ne ferme pas.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  overlay.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      render(index - 1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      render(index + 1);
      return;
    }

    // Maintient le focus dans la visionneuse tant qu'elle est ouverte.
    if (event.key === 'Tab') {
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}
