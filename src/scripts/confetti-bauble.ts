/**
 * Confettis qui se rassemblent en boule de Noël.
 *
 * Le coffret libère une gerbe, dont les particules convergent doucement vers
 * la silhouette d'une boule suspendue, la tiennent le temps d'une respiration,
 * puis se dispersent.
 *
 * Tout se joue sur un canvas : plusieurs centaines de particules en DOM ne
 * tiendraient pas la cadence. La boule est dessinée dans ses vraies couleurs
 * puis échantillonnée : chaque particule adopte la teinte du point qu'elle
 * rejoint, si bien que la forme se colore d'elle-même en se composant.
 *
 * Le calque est décoratif et ne recouvre jamais aucun contenu interactif.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  round: boolean;
  /** Cible, relative au centre de la boule. */
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  delay: number;
}

const PHASE = {
  burst: 900,
  gather: 1300,
  /** Décalage maximal entre la première et la dernière particule. */
  stagger: 420,
  hold: 1500,
  fade: 850,
} as const;

const MAX_PARTICLES = 520;
/** Pas de la première passe, qui sert à jauger la surface à couvrir. */
const PROBE_STEP = 4;
/** Gravité douce : la gerbe doit planer, pas retomber comme une pierre. */
const GRAVITY = 0.24;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

interface Target {
  x: number;
  y: number;
  color: string;
}

/**
 * Dessine la boule hors écran, puis en extrait un nuage de points colorés.
 * Passer par un rendu réel évite de décrire la forme point par point : la
 * silhouette et les couleurs restent définies au même endroit.
 */
function sampleBauble(size: number): { points: Target[]; step: number } {
  const accent = token('--c-accent', '#D32F2F');
  const gold = token('--c-gold', '#C5A059');
  const heading = token('--c-heading', '#1A2C5E');

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { points: [], step: PROBE_STEP };

  const cx = size / 2;
  const radius = size * 0.34;
  const cy = size * 0.6;

  // Sphère
  const sphere = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  sphere.addColorStop(0, accent);
  sphere.addColorStop(1, heading);
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Bandeau doré en travers
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = gold;
  ctx.fillRect(cx - radius, cy - radius * 0.18, radius * 2, radius * 0.36);
  ctx.restore();

  // Éclat, pour que la sphère ne soit pas plate
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(
    cx - radius * 0.38,
    cy - radius * 0.44,
    radius * 0.17,
    radius * 0.1,
    -0.7,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Calotte et anneau de suspension
  ctx.fillStyle = gold;
  ctx.fillRect(cx - size * 0.055, cy - radius - size * 0.075, size * 0.11, size * 0.08);
  ctx.strokeStyle = gold;
  ctx.lineWidth = size * 0.022;
  ctx.beginPath();
  ctx.arc(cx, cy - radius - size * 0.105, size * 0.042, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.stroke();

  const { data } = ctx.getImageData(0, 0, size, size);
  const covered = (x: number, y: number) => data[(y * size + x) * 4 + 3] >= 140;

  // Première passe : combien de points la forme offre-t-elle à ce pas ?
  let probe = 0;
  for (let y = 0; y < size; y += PROBE_STEP) {
    for (let x = 0; x < size; x += PROBE_STEP) if (covered(x, y)) probe++;
  }
  if (probe === 0) return { points: [], step: PROBE_STEP };

  // Pas définitif, choisi pour atteindre le nombre visé. Élargir la grille
  // donne une répartition régulière ; garder un point sur n dans une liste
  // lue ligne par ligne créerait des bandes au lieu d'une surface pleine.
  const step = Math.max(
    PROBE_STEP,
    Math.round(PROBE_STEP * Math.sqrt(probe / MAX_PARTICLES))
  );

  const points: Target[] = [];
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      if (!covered(x, y)) continue;
      const i = (y * size + x) * 4;
      points.push({
        x: x - cx,
        y: y - cy,
        color: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
      });
    }
  }

  return { points, step };
}

interface Options {
  /** Centre de la boule, en coordonnées écran. Par défaut, le centre de l'écran. */
  center?: { x: number; y: number };
  /** Appelé quand la boule commence à se défaire. */
  onDissolve?: () => void;
}

/** Joue la séquence complète depuis la position du coffret. */
export function playConfettiBauble(origin: DOMRect, options: Options = {}): void {
  const stage = Math.round(
    Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.62, 380)
  );
  const { points: targets, step } = sampleBauble(stage);
  if (targets.length === 0) return;

  // Les particules se rejoignent presque : la boule se lit comme une surface
  // en mosaïque plutôt que comme un semis de points.
  const finalSize = step * 0.86;
  const burstSize = Math.min(finalSize, 9);

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

  const startX = origin.left + origin.width / 2;
  const startY = origin.top + origin.height * 0.35;
  const maxRadius = Math.max(
    ...targets.map((t) => Math.hypot(t.x, t.y))
  );

  const particles: Particle[] = targets.map((target, i) => {
    const angle = (-90 + (i / targets.length) * 160 - 80) * (Math.PI / 180);
    const power = 4 + (i % 11) * 0.55;
    // Décalage radial : la boule se compose du coeur vers le bord, ce qui
    // se lit beaucoup plus doucement qu'un ordre arbitraire.
    const radial = Math.hypot(target.x, target.y) / (maxRadius || 1);
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      rot: Math.random() * Math.PI,
      vrot: (i % 2 === 0 ? 1 : -1) * (0.04 + (i % 5) * 0.015),
      size: burstSize,
      color: target.color,
      round: i % 4 === 0,
      tx: target.x,
      ty: target.y,
      sx: 0,
      sy: 0,
      delay: radial * PHASE.stagger,
    };
  });

  const GATHER_AT = PHASE.burst;
  const HOLD_AT = GATHER_AT + PHASE.gather + PHASE.stagger;
  const FADE_AT = HOLD_AT + PHASE.hold;
  const END_AT = FADE_AT + PHASE.fade;

  let started: number | null = null;
  let captured = false;
  let dissolved = false;
  let last = 0;

  window.addEventListener('resize', resize, { passive: true });

  const finish = () => {
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  function frame(now: number) {
    if (started === null) {
      started = now;
      last = now;
    }
    const elapsed = now - started;
    const dt = Math.min((now - last) / 16.67, 2.5);
    last = now;

    ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // La boule se tient à une position d'écran fixe : elle reste visible quoi
    // qu'il arrive, même si l'on défile pendant la séquence. Le rayon sert de
    // marge pour qu'elle ne déborde jamais.
    const margin = maxRadius + 16;
    const cx = Math.min(
      Math.max(options.center?.x ?? window.innerWidth / 2, margin),
      window.innerWidth - margin
    );
    const cy = Math.min(
      Math.max(options.center?.y ?? window.innerHeight / 2, margin),
      window.innerHeight - margin
    );

    if (elapsed >= FADE_AT && !dissolved) {
      dissolved = true;
      options.onDissolve?.();
    }

    if (elapsed >= GATHER_AT && !captured) {
      captured = true;
      particles.forEach((p) => {
        p.sx = p.x;
        p.sy = p.y;
      });
    }

    // Respiration pendant le maintien : léger balancement et souffle.
    let swing = 0;
    let breathe = 1;
    if (elapsed >= HOLD_AT && elapsed < FADE_AT) {
      const t = (elapsed - HOLD_AT) / PHASE.hold;
      swing = Math.sin(t * Math.PI * 2) * 0.035;
      breathe = 1 + Math.sin(t * Math.PI * 2) * 0.012;
    }

    let alpha = 1;
    if (elapsed < 160) alpha = elapsed / 160;
    else if (elapsed > FADE_AT) alpha = 1 - (elapsed - FADE_AT) / PHASE.fade;

    const cos = Math.cos(swing);
    const sin = Math.sin(swing);

    for (const p of particles) {
      if (elapsed < GATHER_AT) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += GRAVITY * dt;
        p.rot += p.vrot * dt;
      } else {
        const t = Math.min(
          Math.max((elapsed - GATHER_AT - p.delay) / PHASE.gather, 0),
          1
        );
        // Arrivée freinée : les particules se posent au lieu de s'arrêter net.
        const k = easeOutQuart(easeInOut(t));

        // Cible tournée par le balancement, autour du centre de la boule.
        const rx = (p.tx * cos - p.ty * sin) * breathe;
        const ry = (p.tx * sin + p.ty * cos) * breathe;

        p.x = p.sx + (cx + rx - p.sx) * k;
        p.y = p.sy + (cy + ry - p.sy) * k;
        p.rot += p.vrot * (1 - k) * dt;
        p.size = burstSize + (finalSize - burstSize) * k;

        // Dispersion finale : la boule se défait vers le bas en s'effaçant.
        if (elapsed > FADE_AT) {
          const f = (elapsed - FADE_AT) / PHASE.fade;
          p.y += f * f * 34 * dt;
          p.rot += p.vrot * f * dt;
        }
      }

      ctx!.save();
      ctx!.globalAlpha = alpha;
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (p.round) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.15);
      }
      ctx!.restore();
    }

    if (elapsed < END_AT) requestAnimationFrame(frame);
    else finish();
  }

  requestAnimationFrame(frame);
}
