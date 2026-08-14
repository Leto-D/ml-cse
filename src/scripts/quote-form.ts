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

/**
 * Environnements sans backend de formulaire : développement local et
 * prévisualisation GitHub Pages, qui ne sert que des fichiers statiques.
 * L'envoi y est simulé pour que le parcours reste démontrable ; une bannière
 * l'annonce explicitement pour ne pas laisser croire à un envoi réel.
 */
function isDemoEnvironment(): boolean {
  const { protocol, hostname } = window.location;
  return (
    protocol === 'file:' ||
    ['localhost', '127.0.0.1'].includes(hostname) ||
    hostname.endsWith('.github.io')
  );
}

/** Bandeau posé au-dessus du formulaire quand aucun envoi réel n'est possible. */
function initDemoNotice() {
  if (!isDemoEnvironment()) return;
  const form = document.getElementById('devis-form');
  if (!form) return;

  const notice = document.createElement('p');
  notice.className = 'demo-notice';
  notice.textContent =
    'Démonstration : le formulaire rejoue le parcours complet, aucune demande n’est réellement envoyée.';
  form.prepend(notice);
}

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

/** Repli sans JavaScript : Netlify renvoie sur ?merci=1 après le POST natif. */
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

    // En démonstration, la confirmation ne doit pas affirmer un envoi réel.
    if (isDemoEnvironment() && !success.querySelector('.demo-notice')) {
      const notice = document.createElement('p');
      notice.className = 'demo-notice';
      notice.textContent =
        'Démonstration : aucune demande n’a réellement été envoyée.';
      success.appendChild(notice);
    }

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

    const sent = isDemoEnvironment()
      ? new Promise<void>((resolve) => window.setTimeout(resolve, 900))
      : fetch(import.meta.env.BASE_URL, {
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
  initDemoNotice();
  initSteppers();
  initProductLinks();
  initSuccessFromQuery();
  initSubmit();

  // Le lien « ?nom= » peut pré-remplir l'entreprise avant que l'UI se synchronise.
  document
    .querySelectorAll<HTMLElement>('[data-multiselect]')
    .forEach(syncMultiSelect);
}
