/**
 * Liste déroulante multi-sélection.
 *
 * Les <input type="checkbox"> restent dans le DOM et gardent le focus clavier :
 * l'état coché est natif, le script ne fait que refléter cet état dans l'UI.
 */

const OPEN = 'is-open';

function itemsOf(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLInputElement>('.mu-item input'));
}

/** Reflète l'état des cases dans le bouton, le compteur et le pied de panneau. */
export function syncMultiSelect(root: HTMLElement): void {
  const inputs = itemsOf(root);
  const checked = inputs.filter((input) => input.checked);
  const n = checked.length;

  const label = root.querySelector<HTMLElement>('.mu-label');
  if (label) {
    if (n === 0) label.textContent = root.dataset.label ?? '';
    else if (n === 1) label.textContent = checked[0].value;
    else label.textContent = `${n} objets`;
  }

  const count = root.querySelector<HTMLElement>('.mu-count');
  if (count) {
    count.textContent = String(n);
    count.hidden = n === 0;
  }

  const footCount = root.querySelector<HTMLElement>('.mu-foot-count');
  if (footCount) {
    footCount.textContent =
      n === 0 ? 'Aucune sélection' : `${n} sélectionné${n > 1 ? 's' : ''}`;
  }

  const clear = root.querySelector<HTMLElement>('.mu-clear');
  if (clear) clear.hidden = n === 0;

  inputs.forEach((input) => {
    input.closest('.mu-item')?.classList.toggle('is-checked', input.checked);
  });

  root.classList.toggle('has-value', n > 0);
}

function close(root: HTMLElement) {
  root.classList.remove(OPEN);
  root
    .querySelector<HTMLButtonElement>('.mu-btn')
    ?.setAttribute('aria-expanded', 'false');
}

function closeAll(except?: HTMLElement) {
  document
    .querySelectorAll<HTMLElement>(`[data-multiselect].${OPEN}`)
    .forEach((el) => {
      if (el !== except) close(el);
    });
}

/** Coche un produit depuis son slug et met l'affichage à jour. */
export function selectProduct(slug: string): void {
  const root = document.querySelector<HTMLElement>('[data-multiselect]');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>(
    `.mu-item[data-product="${CSS.escape(slug)}"] input`
  );
  if (!input) return;
  input.checked = true;
  syncMultiSelect(root);
}

export function initMultiSelects(): void {
  const roots = document.querySelectorAll<HTMLElement>('[data-multiselect]');
  if (roots.length === 0) return;

  roots.forEach((root) => {
    if (root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    const btn = root.querySelector<HTMLButtonElement>('.mu-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const wasOpen = root.classList.contains(OPEN);
      closeAll();
      if (!wasOpen) {
        root.classList.add(OPEN);
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    const inputs = itemsOf(root);
    inputs.forEach((input) => {
      input.addEventListener('change', () => syncMultiSelect(root));
    });

    root.querySelector<HTMLButtonElement>('.mu-clear')?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputs.forEach((input) => {
          input.checked = false;
        });
        syncMultiSelect(root);
        btn.focus();
      }
    );

    // Clavier : Échap referme, flèches parcourent la liste, Home/Fin aux extrémités.
    root.addEventListener('keydown', (e) => {
      const key = (e as KeyboardEvent).key;

      if (key === 'Escape' && root.classList.contains(OPEN)) {
        close(root);
        btn.focus();
        return;
      }

      // Ouvre au clavier depuis le bouton.
      if (
        document.activeElement === btn &&
        (key === 'ArrowDown' || key === 'Enter' || key === ' ')
      ) {
        if (!root.classList.contains(OPEN)) {
          e.preventDefault();
          closeAll();
          root.classList.add(OPEN);
          btn.setAttribute('aria-expanded', 'true');
          inputs[0]?.focus();
        }
        return;
      }

      const current = inputs.indexOf(document.activeElement as HTMLInputElement);
      if (current === -1) return;

      let next = -1;
      if (key === 'ArrowDown') next = Math.min(current + 1, inputs.length - 1);
      else if (key === 'ArrowUp') next = Math.max(current - 1, 0);
      else if (key === 'Home') next = 0;
      else if (key === 'End') next = inputs.length - 1;

      if (next !== -1) {
        e.preventDefault();
        inputs[next].focus();
      }
    });

    syncMultiSelect(root);
  });

  // Un seul écouteur global pour la fermeture au clic extérieur.
  if (!document.body.dataset.muGlobal) {
    document.body.dataset.muGlobal = 'true';
    document.addEventListener('click', (e) => {
      document
        .querySelectorAll<HTMLElement>(`[data-multiselect].${OPEN}`)
        .forEach((root) => {
          if (!root.contains(e.target as Node)) close(root);
        });
    });
  }
}
