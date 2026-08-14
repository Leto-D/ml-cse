/**
 * Formulaire de devis : stepper, pré-sélection produit et envoi.
 *
 * L'envoi intercepte le submit natif pour jouer l'animation pendant que le
 * POST part vers Netlify. Le chemin sans JavaScript (action ?merci=1) reste
 * fonctionnel : il est géré par `initSuccessFromQuery`.
 */

import { selectProduct, syncMultiSelect } from './multiselect';
import { playLetterAnimation, clearLetterAnimation } from './letter-animation';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Boutons +/- de la quantité. */
function initSteppers() {
  document.querySelectorAll<HTMLElement>('.stepper').forEach((stepper) => {
    const input = stepper.querySelector<HTMLInputElement>('input');
    if (!input) return;

    stepper.querySelectorAll<HTMLButtonElement>('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step) || 0;
        const current = Number.parseInt(input.value, 10);
        const base = Number.isNaN(current) ? 1 : current;
        input.value = String(Math.max(1, base + step));
      });
    });
  });
}

/** « Demander un devis » sur une carte coche le produit correspondant. */
function initProductLinks() {
  document
    .querySelectorAll<HTMLAnchorElement>('[data-select-product]')
    .forEach((link) => {
      link.addEventListener('click', () => {
        const slug = link.dataset.selectProduct;
        if (slug) selectProduct(slug);
      });
    });
}

/** Repli sans JavaScript : Netlify renvoie sur /?merci=1 après le POST natif. */
function initSuccessFromQuery() {
  if (new URLSearchParams(window.location.search).get('merci') !== '1') return;
  const form = document.getElementById('devis-form');
  const success = document.getElementById('devis-success');
  if (form) form.style.display = 'none';
  if (success) success.hidden = false;
}

function initSubmit() {
  const form = document.getElementById('devis-form') as HTMLFormElement | null;
  if (!form) return;

  const success = document.getElementById('devis-success');
  const submitBtn = form.querySelector<HTMLButtonElement>('.submit-btn');

  const showSuccess = () => {
    form.style.display = 'none';
    if (!success) return;
    success.hidden = false;
    success.setAttribute('role', 'status');
    success.setAttribute('tabindex', '-1');
    success.focus();
  };

  const showError = () => {
    clearLetterAnimation();
    if (submitBtn) submitBtn.disabled = false;
    if (form.querySelector('.form-error')) return;

    const actions = form.querySelector('.form-actions');
    if (!actions) return;

    // L'adresse de repli est déjà dans le bloc de confirmation : on la réutilise.
    const mailLink = document.querySelector<HTMLAnchorElement>(
      '#devis-success a[href^="mailto:"]'
    );

    const message = document.createElement('p');
    message.className = 'form-error';
    message.append("Envoi impossible pour l’instant.");

    if (mailLink) {
      message.append(' Écrivez-nous à ');
      const link = document.createElement('a');
      link.href = mailLink.href;
      link.textContent = mailLink.textContent ?? '';
      message.append(link, '.');
    }

    actions.appendChild(message);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (submitBtn) submitBtn.disabled = true;
    form.querySelector('.form-error')?.remove();

    // En local, aucun backend Netlify n'écoute : on simule pour tester l'animation.
    const isLocal =
      window.location.protocol === 'file:' ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const sent = isLocal
      ? new Promise<void>((resolve) => window.setTimeout(resolve, 900))
      : fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(
            new FormData(form) as unknown as Record<string, string>
          ).toString(),
        }).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
        });

    const canAnimate =
      !prefersReducedMotion() && 'animate' in Element.prototype && submitBtn;

    if (!canAnimate) {
      sent.then(showSuccess).catch(showError);
      return;
    }

    Promise.all([playLetterAnimation(submitBtn), sent])
      .then(showSuccess)
      .catch(showError);
  });
}

export function initQuoteForm(): void {
  initSteppers();
  initProductLinks();
  initSuccessFromQuery();
  initSubmit();

  // Le lien « ?nom= » peut pré-remplir l'entreprise avant que l'UI se synchronise.
  document
    .querySelectorAll<HTMLElement>('[data-multiselect]')
    .forEach(syncMultiSelect);
}
