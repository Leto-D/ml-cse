/**
 * Page « votre logo sur l'objet » : recherche Brandfetch d'une marque
 * (suggestions avec icônes au fil de la saisie) puis affichage du logo
 * choisi dans la zone de marquage de la photo produit.
 *
 * - Recherche : GET api.brandfetch.io/v2/search/{q}?c={clientID}.
 *   CORS ouvert, clé API inutile → aucun secret côté client.
 * - Aperçu : URL CDN chargée en <img> ; le segment `fallback/404` fait
 *   renvoyer un vrai 404 → onerror. Aucun fetch pour l'aperçu, aucune
 *   dépendance CORS, aucun succès simulé.
 * - Une fois un logo affiché, changer un réglage relance l'aperçu tout
 *   seul : le bouton ne sert qu'à la première recherche ou à la saisie
 *   manuelle d'un domaine.
 *
 * Garde-fou de consommation : voir `allow()` plus bas. Il protège du
 * clic frénétique et de l'onglet oublié, PAS d'un robot déterminé.
 */

const CDN_BASE = 'https://cdn.brandfetch.io/domain';
const SEARCH_API = 'https://api.brandfetch.io/v2/search';
const SEARCH_DEBOUNCE_MS = 400;
/** En dessous, la recherche ramène surtout du bruit et gaspille du quota. */
const MIN_QUERY_LENGTH = 3;
const SUGGESTION_LIMIT = 6;

/** Position et taille de départ de la zone, aussi utilisées par « Recentrer ». */
const DEFAULT_CENTER = 50;
const DEFAULT_SIZE = '42';

/**
 * Plafond d'appels par heure glissante, tenu dans localStorage.
 * Un usage normal (chercher sa marque, comparer trois rendus) reste très
 * en dessous. Un script qui viderait le quota gratuit se moque de cette
 * limite : elle vit dans le navigateur, il suffit de l'ignorer. Seul un
 * proxy côté serveur détenant la clé protégerait réellement le compte.
 */
const QUOTA_KEY = 'logo-preview-quota';
const QUOTA_WINDOW_MS = 60 * 60 * 1000;
const QUOTA_LIMITS: Record<string, number> = { search: 40, preview: 30 };

/**
 * Détourage du fond : tolérance de couleur, et frange adoucie au-delà.
 * 42 sur 255 laisse passer les dégradés légers d'un fond « plat » sans
 * mordre sur un tracé de marque, qui contraste presque toujours plus.
 */
const BG_TOLERANCE = 42;
const BG_FEATHER = 1.2;

interface Suggestion {
  name: string;
  domain: string;
  icon: string;
}

/** Distance de couleur, en somme des écarts par canal. */
function colorDistance(
  data: Uint8ClampedArray,
  a: number,
  b: number
): number {
  return (
    Math.abs(data[a] - data[b]) +
    Math.abs(data[a + 1] - data[b + 1]) +
    Math.abs(data[a + 2] - data[b + 2])
  );
}

/**
 * Rend transparent le fond plein d'un logo (typiquement la vignette carrée
 * de Brandfetch), pour qu'il se pose sur la matière au lieu d'y être collé
 * comme un autocollant.
 *
 * Remplissage par diffusion depuis les bords, jamais un remplacement
 * global : un aplat de la même couleur à l'intérieur du tracé doit rester.
 * Renvoie une data-URL, ou `null` si rien n'est à faire — image déjà
 * transparente, fond non uniforme, canevas contaminé par le CORS, ou
 * résultat quasi vide, signe d'une détection ratée.
 */
function knockoutBackground(img: HTMLImageElement): string | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, w, h);
  } catch {
    // Canevas contaminé : l'image n'a pas été servie avec les en-têtes CORS.
    return null;
  }
  const px = image.data;

  // Le pourtour doit être opaque et d'une seule couleur, sinon on ne touche
  // à rien : mieux vaut un autocollant qu'un logo troué.
  const edge: number[] = [];
  for (let i = 0; i < w; i += Math.max(1, Math.floor(w / 12))) {
    edge.push((0 * w + i) * 4, ((h - 1) * w + i) * 4);
  }
  for (let j = 0; j < h; j += Math.max(1, Math.floor(h / 12))) {
    edge.push((j * w + 0) * 4, (j * w + (w - 1)) * 4);
  }

  const origin = edge[0];
  if (px[origin + 3] < 250) return null;
  for (const offset of edge) {
    if (px[offset + 3] < 250) return null;
    if (colorDistance(px, offset, origin) > BG_TOLERANCE) return null;
  }

  const bg = [px[origin], px[origin + 1], px[origin + 2]];
  const near = (offset: number): number =>
    Math.abs(px[offset] - bg[0]) +
    Math.abs(px[offset + 1] - bg[1]) +
    Math.abs(px[offset + 2] - bg[2]);

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < w; i++) {
    stack.push(i, (h - 1) * w + i);
  }
  for (let j = 0; j < h; j++) {
    stack.push(j * w, j * w + w - 1);
  }

  let cleared = 0;
  while (stack.length) {
    const index = stack.pop() as number;
    if (seen[index]) continue;
    seen[index] = 1;

    const offset = index * 4;
    const distance = near(offset);
    if (distance > BG_TOLERANCE * (1 + BG_FEATHER)) continue;

    if (distance <= BG_TOLERANCE) {
      px[offset + 3] = 0;
      cleared++;
    } else {
      // Frange de transition : opacité proportionnelle, et on s'arrête là
      // pour ne pas ronger le tracé.
      const ratio = (distance - BG_TOLERANCE) / (BG_TOLERANCE * BG_FEATHER);
      px[offset + 3] = Math.round(px[offset + 3] * ratio);
      continue;
    }

    const x = index % w;
    const y = (index - x) / w;
    if (x > 0) stack.push(index - 1);
    if (x < w - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - w);
    if (y < h - 1) stack.push(index + w);
  }

  // Presque tout effacé : la couleur détectée était celle du logo lui-même.
  if (cleared > w * h * 0.97) return null;

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Consomme un jeton du quota. `false` = plafond atteint pour cette heure. */
function allow(kind: 'search' | 'preview'): boolean {
  const now = Date.now();
  let store: Record<string, number[]> = {};
  try {
    store = JSON.parse(window.localStorage.getItem(QUOTA_KEY) ?? '{}');
  } catch {
    // Stockage indisponible (navigation privée) : on laisse passer.
    return true;
  }

  const hits = (store[kind] ?? []).filter(
    (time) => now - time < QUOTA_WINDOW_MS
  );
  if (hits.length >= QUOTA_LIMITS[kind]) return false;

  hits.push(now);
  store[kind] = hits;
  try {
    window.localStorage.setItem(QUOTA_KEY, JSON.stringify(store));
  } catch {
    // Écriture refusée : le garde-fou est inopérant, l'usage reste normal.
  }
  return true;
}

/**
 * Zone logo déplaçable et redimensionnable sur la photo produit.
 * Position en pourcentages du conteneur (reste proportionnel au
 * responsive) ; taille pilotée par le curseur et les touches +/−.
 */
function initZonePlacement(
  zone: HTMLElement,
  container: HTMLElement,
  sizeInput: HTMLInputElement
): { reset: () => void; refresh: () => void } {
  let centerX = DEFAULT_CENTER;
  let centerY = DEFAULT_CENTER;

  /**
   * Le centre est le modèle, le coin haut-gauche est ce qu'on écrit : la
   * zone ne peut pas se centrer par `transform` sans isoler ses fusions
   * de la photo. D'où la mesure de sa taille réelle à chaque pose.
   */
  const apply = (): void => {
    const halfW = (zone.offsetWidth / Math.max(container.offsetWidth, 1)) * 50;
    const halfH = (zone.offsetHeight / Math.max(container.offsetHeight, 1)) * 50;
    zone.style.left = `${centerX - halfW}%`;
    zone.style.top = `${centerY - halfH}%`;
  };
  apply();

  // La taille de la zone dépend du logo affiché et de la largeur du conteneur.
  window.addEventListener('resize', apply, { passive: true });

  const applySize = (): void => {
    zone.style.width = `${sizeInput.value}%`;
    apply();
  };

  sizeInput.addEventListener('input', applySize);

  zone.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    zone.setPointerCapture(event.pointerId);
    zone.classList.add('dragging');

    const startX = event.clientX;
    const startY = event.clientY;
    const contW = container.offsetWidth;
    const contH = container.offsetHeight;
    const halfW = zone.offsetWidth / 2;
    const halfH = zone.offsetHeight / 2;
    const startCenterX = (centerX / 100) * contW;
    const startCenterY = (centerY / 100) * contH;

    const onMove = (moveEvent: PointerEvent): void => {
      const px = clamp(
        startCenterX + moveEvent.clientX - startX,
        halfW,
        contW - halfW
      );
      const py = clamp(
        startCenterY + moveEvent.clientY - startY,
        halfH,
        contH - halfH
      );
      centerX = (px / contW) * 100;
      centerY = (py / contH) * 100;
      apply();
    };

    const stop = (): void => {
      zone.classList.remove('dragging');
      zone.removeEventListener('pointermove', onMove);
    };

    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', stop, { once: true });
    zone.addEventListener('pointercancel', stop, { once: true });
  });

  zone.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 4 : 1;
    switch (event.key) {
      case 'ArrowLeft':
        centerX = clamp(centerX - step, 0, 100);
        break;
      case 'ArrowRight':
        centerX = clamp(centerX + step, 0, 100);
        break;
      case 'ArrowUp':
        centerY = clamp(centerY - step, 0, 100);
        break;
      case 'ArrowDown':
        centerY = clamp(centerY + step, 0, 100);
        break;
      case '+':
      case '=':
        sizeInput.stepUp();
        applySize();
        break;
      case '-':
        sizeInput.stepDown();
        applySize();
        break;
      default:
        return;
    }
    event.preventDefault();
    apply();
  });

  return {
    reset: () => {
      centerX = DEFAULT_CENTER;
      centerY = DEFAULT_CENTER;
      sizeInput.value = DEFAULT_SIZE;
      applySize();
    },
    refresh: apply,
  };
}

export function initLogoPreview(): void {
  const form = document.getElementById('logo-form') as HTMLFormElement | null;
  const zone = document.querySelector('.logo-zone') as HTMLElement | null;
  const feedback = document.getElementById(
    'logo-feedback'
  ) as HTMLElement | null;
  const list = document.getElementById('logo-suggestions');
  if (!form || !zone || !feedback || !list) return;

  const domain = form.querySelector(
    '[name="domain"]'
  ) as HTMLInputElement | null;
  const override = form.querySelector(
    '[name="client-id"]'
  ) as HTMLInputElement | null;
  const sizeInput = document.getElementById(
    'logo-size'
  ) as HTMLInputElement | null;
  const mark = zone.querySelector('.logo-mark') as HTMLElement | null;
  const placeholder = zone.querySelector(
    '.logo-placeholder'
  ) as HTMLElement | null;
  const resetBtn = document.getElementById('logo-reset');
  const container = zone.closest('.product-visual') as HTMLElement | null;
  if (!domain || !override || !sizeInput || !mark || !placeholder || !container)
    return;

  // Le client ID arrive encodé pour ne pas traîner en clair dans le HTML.
  // Ce n'est pas un secret : c'est juste moins facile à récolter en masse.
  let defaultClientId = '';
  try {
    defaultClientId = form.dataset.cid ? window.atob(form.dataset.cid) : '';
  } catch {
    defaultClientId = '';
  }
  const currentClientId = (): string =>
    override.value.trim() || defaultClientId;

  /** Les réglages sont des groupes de boutons radio : on lit le coché. */
  const picked = (name: string): string =>
    (form.querySelector(`[name="${name}"]:checked`) as HTMLInputElement | null)
      ?.value ?? '';

  // data-render survit au remplacement du contenu de la zone.
  const applyRender = (): void => {
    zone.dataset.render = picked('render');
  };
  applyRender();

  const placement = initZonePlacement(zone, container, sizeInput);
  resetBtn?.addEventListener('click', () => placement.reset());

  let suggestions: Suggestion[] = [];
  let activeIndex = -1;
  let searchToken = 0;
  let debounce = 0;
  /** Un logo est-il déjà affiché ? Conditionne le rafraîchissement auto. */
  let hasLogo = false;

  const say = (message: string): void => {
    feedback.textContent = message;
    feedback.classList.remove('error');
  };

  const fail = (message: string): void => {
    feedback.textContent = message;
    feedback.classList.add('error');
  };

  const closeList = (): void => {
    list.replaceChildren();
    list.hidden = true;
    suggestions = [];
    activeIndex = -1;
    domain.setAttribute('aria-expanded', 'false');
  };

  const runPreview = (): void => {
    const name = domain.value.trim().toLowerCase();
    const id = currentClientId();
    say('');

    if (!name) {
      fail('Indiquez le nom ou le site de votre entreprise.');
      return;
    }
    if (!name.includes('.')) {
      fail(
        `« ${name} » n’est pas un domaine complet : choisissez une suggestion dans la liste.`
      );
      return;
    }
    if (!id) {
      fail('Client ID Brandfetch manquant (voir les réglages avancés).');
      return;
    }
    if (!allow('preview')) {
      fail(
        'Trop d’aperçus demandés sur la dernière heure. Réessayez plus tard.'
      );
      return;
    }

    say('Chargement…');
    zone.classList.add('is-loading');

    const url = `${CDN_BASE}/${encodeURIComponent(name)}/theme/${picked(
      'theme'
    )}/fallback/404/${picked('variant')}?c=${encodeURIComponent(id)}`;

    const show = (source: string, img: HTMLImageElement, cut: boolean): void => {
      // La même source sert aux copies en relief posées en pseudo-éléments.
      mark.style.setProperty('--logo-url', `url("${source}")`);
      img.alt = `Logo ${name}`;
      mark.replaceChildren(img);
      mark.hidden = false;
      placeholder.hidden = true;
      zone.classList.remove('is-loading');
      // Un logo détouré n'a plus de fond à faire disparaître : le multiply
      // deviendrait nuisible sur un tracé clair, qu'il effacerait.
      if (cut) zone.dataset.cut = 'true';
      else delete zone.dataset.cut;
      // La hauteur de la zone vient de changer : on repose son coin.
      placement.refresh();
      hasLogo = true;
      say(
        'Aperçu à titre indicatif : le rendu réel dépend du support et de la technique.'
      );
    };

    // Premier essai avec CORS : c'est ce qui autorise la lecture du canevas,
    // donc le détourage du fond. Un échec ici ne prouve pas que le logo
    // n'existe pas, d'où la seconde tentative sans CORS avant d'abandonner.
    const cors = new Image();
    cors.crossOrigin = 'anonymous';
    cors.onload = () => {
      const cleaned = knockoutBackground(cors);
      if (!cleaned) {
        show(url, cors, false);
        return;
      }
      const flat = new Image();
      flat.onload = () => show(cleaned, flat, true);
      flat.src = cleaned;
    };
    cors.onerror = () => {
      const plain = new Image();
      plain.onload = () => show(url, plain, false);
      plain.onerror = () => {
        // La zone (placeholder ou logo précédent) reste inchangée.
        zone.classList.remove('is-loading');
        fail(`Logo introuvable pour « ${name} ».`);
      };
      plain.src = url;
    };
    cors.src = url;
  };

  const select = (index: number): void => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    domain.value = suggestion.domain;
    closeList();
    runPreview();
  };

  const renderList = (): void => {
    list.replaceChildren();
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'option');
      if (index === activeIndex) item.classList.add('active');

      if (suggestion.icon) {
        const icon = document.createElement('img');
        icon.src = suggestion.icon;
        icon.alt = '';
        icon.width = 20;
        icon.height = 20;
        item.append(icon);
      }

      const label = document.createElement('span');
      label.className = 'sugg-name';
      label.textContent = suggestion.name;
      const host = document.createElement('span');
      host.className = 'sugg-domain';
      host.textContent = suggestion.domain;
      item.append(label, host);

      // mousedown (pas click) pour devancer le blur de l'input.
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        select(index);
      });
      list.append(item);
    });
    list.hidden = suggestions.length === 0;
    domain.setAttribute('aria-expanded', String(!list.hidden));
  };

  const search = (query: string): void => {
    const id = currentClientId();
    if (!id) return;
    if (!allow('search')) {
      closeList();
      fail(
        'Trop de recherches sur la dernière heure. Saisissez le domaine directement, ou réessayez plus tard.'
      );
      return;
    }
    const token = ++searchToken;

    void fetch(
      `${SEARCH_API}/${encodeURIComponent(query)}?c=${encodeURIComponent(id)}`
    )
      .then((response) => (response.ok ? response.json() : []))
      .then(
        (
          rows: Array<{
            name?: string;
            domain?: string;
            icon?: string;
          }>
        ) => {
          // Une réponse plus ancienne ne doit jamais écraser la récente.
          if (token !== searchToken) return;
          suggestions = rows
            .filter((row) => row.domain && row.icon)
            .slice(0, SUGGESTION_LIMIT)
            .map((row) => ({
              name: row.name ?? row.domain ?? '',
              domain: row.domain ?? '',
              icon: row.icon ?? '',
            }));
          activeIndex = -1;
          renderList();
        }
      )
      .catch(() => {
        // La recherche est une aide : en cas d'échec, saisie manuelle.
      });
  };

  domain.addEventListener('input', () => {
    const query = domain.value.trim();
    window.clearTimeout(debounce);
    if (query.length < MIN_QUERY_LENGTH) {
      closeList();
      return;
    }
    debounce = window.setTimeout(() => search(query), SEARCH_DEBOUNCE_MS);
  });

  domain.addEventListener('keydown', (event) => {
    if (list.hidden) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex =
        (activeIndex + delta + suggestions.length) % suggestions.length;
      renderList();
    } else if (event.key === 'Enter') {
      // Entrée avec la liste ouverte : sélection, pas d'envoi du formulaire.
      event.preventDefault();
      select(activeIndex >= 0 ? activeIndex : 0);
    } else if (event.key === 'Escape') {
      closeList();
    }
  });

  domain.addEventListener('blur', closeList);

  // Changer un réglage rafraîchit l'aperçu sans repasser par le bouton.
  // La technique de marquage est purement CSS : aucune requête réseau.
  form.addEventListener('change', (event) => {
    const name = (event.target as HTMLInputElement | null)?.name;
    if (name === 'render') {
      applyRender();
      return;
    }
    if ((name === 'variant' || name === 'theme') && hasLogo) runPreview();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runPreview();
  });
}
