/**
 * Animation « lettre de Noël » jouée à l'envoi du formulaire.
 *
 * L'enveloppe apparaît sur le bouton, se scelle, puis part en diagonale
 * accompagnée de quelques particules dorées. Durée totale ~1,45 s.
 * L'overlay est décoratif (aria-hidden) et retiré du DOM à la fin.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const TIMING = {
  appear: 250,
  seal: 250,
  fly: 900,
  total: 1450,
} as const;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

/** Lit une couleur de la palette pour que l'animation suive le client actif. */
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function buildEnvelope() {
  const accent = token('--c-accent', '#D32F2F');
  const gold = token('--c-gold', '#C5A059');

  const svg = el('svg', {
    class: 'letter-env',
    viewBox: '0 0 120 86',
    width: '120',
    height: '86',
  });

  svg.appendChild(
    el('rect', {
      x: '4',
      y: '19',
      width: '112',
      height: '63',
      rx: '5',
      fill: '#FAF7F1',
      stroke: '#D9CFB8',
      'stroke-width': '1.6',
    })
  );

  const flap = el('g', { class: 'env-flap' });
  flap.appendChild(
    el('path', {
      d: 'M4 20 L60 5 L116 20',
      fill: '#F1E8D3',
      stroke: '#D9CFB8',
      'stroke-width': '1.6',
      'stroke-linejoin': 'round',
    })
  );
  svg.appendChild(flap);

  const seal = el('g', { class: 'env-seal' });
  seal.appendChild(
    el('circle', {
      cx: '60',
      cy: '48',
      r: '12',
      fill: accent,
      stroke: gold,
      'stroke-width': '1.5',
    })
  );
  seal.appendChild(
    el('circle', {
      cx: '60',
      cy: '48',
      r: '3.6',
      fill: 'rgba(0,0,0,0.22)',
    })
  );
  svg.appendChild(seal);

  return { svg, flap, seal };
}

/**
 * Joue l'animation depuis la position du bouton.
 * La promesse se résout quand l'overlay a été retiré.
 */
export function playLetterAnimation(anchor: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const rect = anchor.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.id = 'letter-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const stage = document.createElement('div');
    stage.className = 'letter-stage';
    stage.style.left = `${rect.left + rect.width / 2}px`;
    stage.style.top = `${rect.top + rect.height / 2}px`;

    const { svg, flap, seal } = buildEnvelope();

    const particleWrap = document.createElement('div');
    particleWrap.className = 'letter-particles';
    const particles = Array.from({ length: 7 }, () => {
      const span = document.createElement('span');
      particleWrap.appendChild(span);
      return span;
    });

    stage.append(svg, particleWrap);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    // Phase A : l'enveloppe apparaît sur le bouton.
    stage.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.9)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      ],
      { duration: TIMING.appear, easing: 'ease-out', fill: 'forwards' }
    );

    // Phase B : le rabat se ferme, le cachet de cire se pose.
    const sealTimer = window.setTimeout(() => {
      flap.animate(
        [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)' }],
        { duration: TIMING.seal, easing: 'ease-in', fill: 'forwards' }
      );
      seal.animate(
        [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        {
          duration: TIMING.seal - 20,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          fill: 'forwards',
        }
      );
    }, TIMING.appear);

    // Phase C : départ en diagonale + sillage doré.
    const flyTimer = window.setTimeout(() => {
      stage.animate(
        [
          {
            transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
            opacity: 1,
          },
          {
            transform:
              'translate(calc(-50% + 230px), calc(-50% - 190px)) scale(0.3) rotate(-12deg)',
            opacity: 0,
          },
        ],
        {
          duration: TIMING.fly,
          easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
          fill: 'forwards',
        }
      );

      particles.forEach((particle, i) => {
        // Dispersion déterministe : évite le scintillement d'un Math.random().
        const spread = ((i % 4) - 1.5) * 14;
        particle.animate(
          [
            { transform: 'translate(-50%, -50%) translate(0, 0)', opacity: 0 },
            { opacity: 0.5, offset: 0.25 },
            {
              transform: `translate(-50%, -50%) translate(${spread}px, -95px)`,
              opacity: 0,
            },
          ],
          {
            duration: TIMING.fly,
            delay: i * 45,
            easing: 'ease-out',
            fill: 'forwards',
          }
        );
      });
    }, TIMING.appear + TIMING.seal);

    window.setTimeout(() => {
      window.clearTimeout(sealTimer);
      window.clearTimeout(flyTimer);
      overlay.remove();
      resolve();
    }, TIMING.total);
  });
}

/** Retire l'overlay si l'envoi échoue en cours d'animation. */
export function clearLetterAnimation(): void {
  document.getElementById('letter-overlay')?.remove();
}
