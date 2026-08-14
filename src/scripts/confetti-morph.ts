/**
 * Confettis qui se recomposent en titre.
 *
 * Le coffret libère une gerbe de particules, qui retombent puis convergent
 * doucement vers la forme des deux lignes de titre de la section suivante,
 * avant de s'effacer en laissant place au vrai texte.
 *
 * Tout se joue sur un seul canvas : plusieurs centaines de particules en DOM
 * ne tiendraient pas 60 images par seconde.
 *
 * Le texte réel n'est jamais remplacé. Il est simplement masqué le temps que
 * les particules le dessinent, puis révélé : lecteurs d'écran, sélection et
 * indexation ne voient aucune différence, et si le script échoue le titre
 * reste visible.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
  /** Cible, en coordonnées relatives au bloc de titre. */
  tx: number;
  ty: number;
  /** Position au moment où la convergence démarre. */
  sx: number;
  sy: number;
  delay: number;
}

const PHASE = {
  burst: 1000,
  morph: 950,
  stagger: 260,
  hold: 620,
  fade: 520,
} as const;

const MAX_PARTICLES = 460;
const SAMPLE_STEP = 4;
const GRAVITY = 0.42;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function palette(): string[] {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return [
    read('--c-accent', '#D32F2F'),
    read('--c-gold', '#C5A059'),
    read('--c-heading', '#1A2C5E'),
  ];
}

/**
 * Relève la boîte de chaque caractère réellement rendu.
 *
 * Passer par des Range plutôt que par une remise en page maison garantit que
 * les particules épousent le texte tel qu'il s'affiche : retours à la ligne,
 * centrage et interlettrage compris, à n'importe quelle largeur d'écran.
 */
function glyphBoxes(el: Element): { char: string; rect: DOMRect }[] {
  const out: { char: string; rect: DOMRect }[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();

  let node: Node | null = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      if (!text[i].trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) out.push({ char: text[i], rect });
    }
    node = walker.nextNode();
  }
  return out;
}

/** Dessine les titres hors écran et en extrait un nuage de points. */
function sampleTargets(
  header: HTMLElement,
  sources: HTMLElement[]
): { x: number; y: number }[] {
  const box = header.getBoundingClientRect();
  const width = Math.ceil(box.width);
  const height = Math.ceil(box.height);
  if (width < 40 || height < 20) return [];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  for (const source of sources) {
    const style = getComputedStyle(source);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const fontSize = Number.parseFloat(style.fontSize);

    // Position de la ligne de base, selon le modèle des boîtes en ligne :
    // la hauteur d'un caractère est celle de la boîte em de la police, pas
    // `font-size`. Confondre les deux décale le texte de quelques pixels.
    const metrics = ctx.measureText('Hxg');
    const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent || fontSize * 0.2;
    const contentHeight = ascent + descent;

    for (const { char, rect } of glyphBoxes(source)) {
      const halfLeading = (rect.height - contentHeight) / 2;
      const baseline = rect.top + halfLeading + ascent;
      ctx.fillText(char, rect.left - box.left, baseline - box.top);
    }
  }

  const { data } = ctx.getImageData(0, 0, width, height);
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      if (data[(y * width + x) * 4 + 3] > 128) points.push({ x, y });
    }
  }

  // Échantillonnage régulier : garde le trait lisible même en réduisant.
  if (points.length > MAX_PARTICLES) {
    const stride = points.length / MAX_PARTICLES;
    const kept: { x: number; y: number }[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      kept.push(points[Math.floor(i * stride)]);
    }
    return kept;
  }
  return points;
}

/**
 * Joue la séquence complète. La promesse se résout une fois le canvas retiré.
 * `header` sert de repère : les cibles sont stockées en coordonnées relatives,
 * si bien que le titre reste épousé même si l'on défile pendant l'animation.
 */
export function playConfettiMorph(
  origin: DOMRect,
  header: HTMLElement,
  sources: HTMLElement[]
): void {
  const targets = sampleTargets(header, sources);
  const colors = palette();

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const count = targets.length || 60;
  const startX = origin.left + origin.width / 2;
  const startY = origin.top + origin.height * 0.3;

  const particles: Particle[] = Array.from({ length: count }, (_, i) => {
    const angle = (-90 + (i / count) * 150 - 75) * (Math.PI / 180);
    const power = 5.5 + (i % 9) * 0.75;
    const target = targets[i];
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      rot: Math.random() * Math.PI,
      vrot: (i % 2 === 0 ? 1 : -1) * (0.06 + (i % 5) * 0.02),
      w: 7,
      h: 10,
      color: colors[i % colors.length],
      round: i % 3 === 0,
      tx: target ? target.x : 0,
      ty: target ? target.y : 0,
      sx: 0,
      sy: 0,
      delay: (i % 14) * (PHASE.stagger / 14),
    };
  });

  // Masque le vrai titre pendant que les particules le dessinent.
  const hasTargets = targets.length > 0;
  if (hasTargets) {
    sources.forEach((el) => {
      el.style.transition = 'opacity 0.45s ease';
      el.style.opacity = '0';
    });
  }

  let revealed = false;
  const revealText = () => {
    if (revealed) return;
    revealed = true;
    sources.forEach((el) => {
      el.style.opacity = '';
      // Laisse la transition se jouer avant de rendre la main au CSS.
      window.setTimeout(() => el.style.removeProperty('transition'), 600);
    });
  };

  const MORPH_AT = PHASE.burst;
  const HOLD_AT = MORPH_AT + PHASE.morph + PHASE.stagger;
  const FADE_AT = HOLD_AT + PHASE.hold;
  const END_AT = FADE_AT + PHASE.fade;

  let started: number | null = null;
  let captured = false;
  let last = 0;

  // Filet de sécurité : le titre est masqué le temps de l'animation. Si celle-ci
  // s'interrompt — onglet mis en veille, erreur inattendue — il doit réapparaître
  // quoi qu'il arrive plutôt que de rester invisible.
  window.setTimeout(revealText, END_AT + 1500);

  window.addEventListener('resize', resize, { passive: true });

  function frame(now: number) {
    if (started === null) {
      started = now;
      last = now;
    }
    const elapsed = now - started;
    // Normalisé sur 60 im/s, et borné pour qu'un onglet en arrière-plan
    // ne fasse pas exploser l'intégration au retour.
    const dt = Math.min((now - last) / 16.67, 2.5);
    last = now;

    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Le titre peut défiler : on relit sa position à chaque image.
    const box = header.getBoundingClientRect();

    let alpha = 1;
    if (elapsed > FADE_AT) {
      alpha = 1 - (elapsed - FADE_AT) / PHASE.fade;
    }

    if (elapsed >= MORPH_AT && !captured) {
      captured = true;
      particles.forEach((p) => {
        p.sx = p.x;
        p.sy = p.y;
      });
    }

    if (elapsed >= FADE_AT && hasTargets) revealText();

    for (const p of particles) {
      if (elapsed < MORPH_AT || !hasTargets) {
        // Gerbe : vitesse initiale, gravité, rotation libre.
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += GRAVITY * dt;
        p.rot += p.vrot * dt;
      } else {
        // Convergence : chaque particule rejoint sa place, avec un léger décalage.
        const t = Math.min(
          Math.max((elapsed - MORPH_AT - p.delay) / PHASE.morph, 0),
          1
        );
        const k = easeInOut(t);
        p.x = p.sx + (box.left + p.tx - p.sx) * k;
        p.y = p.sy + (box.top + p.ty - p.sy) * k;
        // La rotation s'éteint à mesure que la lettre se forme.
        p.rot += p.vrot * (1 - k) * dt;
        p.w = 7 - 3 * k;
        p.h = 10 - 6 * k;
      }

      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (p.round) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx!.restore();
    }

    if (elapsed < END_AT) {
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener('resize', resize);
      canvas.remove();
      revealText();
    }
  }

  requestAnimationFrame(frame);
}
