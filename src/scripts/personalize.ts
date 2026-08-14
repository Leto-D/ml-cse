/**
 * Personnalisation par URL : `?nom=Alsace%20Lait`.
 *
 * Permet d'envoyer à un prospect un lien à son nom sans rebuild. Les gabarits
 * viennent de la config client (bloc `personalization`), sérialisés au build
 * dans un <script type="application/json">. Sans paramètre, la landing reste
 * dans sa version générique.
 */

export interface PersonalizationTemplates {
  metaTitle: string;
  metaDescription: string;
  heroLead: string;
  heroJoin: string;
  contactTitle: string;
  footerLine: string;
}

/** Lit les gabarits sérialisés dans la page. */
function readTemplates(): PersonalizationTemplates | null {
  const node = document.getElementById('personalization-data');
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as PersonalizationTemplates;
  } catch {
    return null;
  }
}

const MAX_LENGTH = 40;

const fill = (template: string, name: string) => template.replaceAll('{nom}', name);

function setText(selector: string, value: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.textContent = value;
}

export function initPersonalization(): void {
  const raw = new URLSearchParams(window.location.search).get('nom') ?? '';
  const name = raw.trim().slice(0, MAX_LENGTH);
  if (!name) return;

  const t = readTemplates();
  if (!t) return;

  document.title = fill(t.metaTitle, name);
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', fill(t.metaDescription, name));

  setText('[data-brand]', name);
  setText('[data-hero-lead]', t.heroLead);
  setText('[data-hero-join]', t.heroJoin);
  setText('[data-hero-accent]', name);
  setText('[data-contact-title]', fill(t.contactTitle, name));
  setText('[data-footer-line]', fill(t.footerLine, name));

  const company = document.querySelector<HTMLInputElement>('#f-entreprise');
  if (company && !company.value) company.value = name;
}
