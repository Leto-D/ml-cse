/**
 * Lecteur de tracés SVG, sans dépendance.
 *
 * Ne fait qu'une chose : rendre chaque sous-tracé sous forme de polygone, dans
 * un repère choisi. Les courbes sont subdivisées jusqu'à ce que leur flèche
 * tombe sous une tolérance exprimée dans CE repère — pas en unités SVG. Une
 * lettre haute de trois millimètres et un cercle de dix centimètres reçoivent
 * ainsi la finesse qu'ils méritent, et non le même nombre de segments.
 */

/* ── Matrices 2×3, dans l'ordre de SVG : [a b c d e f] ────────────────────── */
export const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const IDENTITY = [1, 0, 0, 1, 0, 0];

/** Analyse l'attribut `transform` d'un élément SVG. */
export function parseTransform(s) {
  let m = IDENTITY;
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let hit;
  while ((hit = re.exec(s))) {
    const v = hit[2].trim().split(/[\s,]+/).map(Number);
    let t;
    switch (hit[1]) {
      case 'matrix': t = v.slice(0, 6); break;
      case 'translate': t = [1, 0, 0, 1, v[0], v[1] || 0]; break;
      case 'scale': t = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0]; break;
      case 'rotate': {
        const a = (v[0] * Math.PI) / 180;
        const [c, si] = [Math.cos(a), Math.sin(a)];
        t = [c, si, -si, c, 0, 0];
        if (v.length === 3) t = mul([1, 0, 0, 1, v[1], v[2]], mul(t, [1, 0, 0, 1, -v[1], -v[2]]));
        break;
      }
      case 'skewX': t = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0]; break;
      default: t = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
    }
    m = mul(m, t);
  }
  return m;
}

/* ── Découpage de l'attribut `d` ──────────────────────────────────────────── */
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  let hit;
  while ((hit = re.exec(d))) out.push(hit[1] ?? Number(hit[2]));
  const cmds = [];
  for (let i = 0; i < out.length; ) {
    let letter = out[i++];
    if (typeof letter !== 'string') throw new Error(`tracé mal formé près de « ${out[i - 1]} »`);
    for (;;) {
      const key = letter.toUpperCase();
      const n = ARGC[key];
      const args = out.slice(i, i + n);
      i += n;
      cmds.push([letter, args]);
      // Un jeu d'arguments supplémentaire répète la commande ; après un M
      // c'est un L, la seule irrégularité de la grammaire.
      if (typeof out[i] === 'string' || i >= out.length) break;
      if (key === 'M') letter = letter === 'M' ? 'L' : 'l';
      if (key === 'Z') break;
    }
  }
  return cmds;
}

/* ── Aplatissement ────────────────────────────────────────────────────────── */
function flattenCubic(push, p0, p1, p2, p3, tol, depth = 0) {
  // Flèche majorée par la distance des points de contrôle à la corde.
  const dx = p3[0] - p0[0];
  const dy = p3[1] - p0[1];
  const d1 = Math.abs((p1[0] - p3[0]) * dy - (p1[1] - p3[1]) * dx);
  const d2 = Math.abs((p2[0] - p3[0]) * dy - (p2[1] - p3[1]) * dx);
  const dd = (d1 + d2) ** 2;
  if (depth > 18 || dd < tol * tol * (dx * dx + dy * dy)) {
    push(p3);
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [a, b, c] = [mid(p0, p1), mid(p1, p2), mid(p2, p3)];
  const [e, f] = [mid(a, b), mid(b, c)];
  const g = mid(e, f);
  flattenCubic(push, p0, a, e, g, tol, depth + 1);
  flattenCubic(push, g, f, c, p3, tol, depth + 1);
}

/** Arc elliptique SVG → suite de cubiques (conversion endpoint → centre). */
function arcToCubics(p0, rx, ry, phi, largeArc, sweep, p1) {
  if (rx === 0 || ry === 0) return [[p0, p0, p1, p1]];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const [cosP, sinP] = [Math.cos(phi), Math.sin(phi)];
  const dx2 = (p0[0] - p1[0]) / 2;
  const dy2 = (p0[1] - p1[1]) / 2;
  const x1 = cosP * dx2 + sinP * dy2;
  const y1 = -sinP * dx2 + cosP * dy2;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) /
    (rx * rx * y1 * y1 + ry * ry * x1 * x1));
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(sq);
  const cx1 = (coef * rx * y1) / ry;
  const cy1 = (-coef * ry * x1) / rx;
  const cx = cosP * cx1 - sinP * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sinP * cx1 + cosP * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => {
    const s = Math.sign(ux * vy - uy * vx) || 1;
    const c = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy));
    return s * Math.acos(Math.min(1, Math.max(-1, c)));
  };
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;

  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (t) => {
    const [c, s] = [Math.cos(t), Math.sin(t)];
    return [cx + cosP * rx * c - sinP * ry * s, cy + sinP * rx * c + cosP * ry * s];
  };
  const dAt = (t) => {
    const [c, s] = [Math.cos(t), Math.sin(t)];
    return [-cosP * rx * s - sinP * ry * c, -sinP * rx * s + cosP * ry * c];
  };
  const out = [];
  for (let i = 0; i < segs; i++) {
    const ta = t0 + i * step;
    const tb = ta + step;
    const [a, b] = [at(ta), at(tb)];
    const [da, db] = [dAt(ta), dAt(tb)];
    out.push([a, [a[0] + k * da[0], a[1] + k * da[1]], [b[0] - k * db[0], b[1] - k * db[1]], b]);
  }
  return out;
}

/**
 * Rend les sous-tracés d'un attribut `d`, exprimés dans le repère de `matrix`.
 *
 * `tol`  : flèche maximale tolérée, dans le repère d'arrivée.
 * `minSeg` : longueur en deçà de laquelle un point est fondu avec le précédent.
 *   Deux points confondus donnent une oreille dégénérée à la triangulation puis
 *   une normale non unitaire à l'extrusion — la cause même du scintillement
 *   qu'on a mis des jours à trouver.
 */
export function subpaths(d, matrix, tol, minSeg) {
  const T = (x, y) => apply(matrix, x, y);
  const rings = [];
  let ring = null;
  let cur = [0, 0];
  let start = [0, 0];
  let prevCtrl = null;
  let prevCmd = '';

  const push = (p) => {
    const last = ring[ring.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < minSeg) return;
    ring.push(p);
  };
  const open = (p) => {
    if (ring && ring.length > 2) rings.push(ring);
    ring = [T(p[0], p[1])];
  };

  for (const [letter, a] of tokenize(d)) {
    const key = letter.toUpperCase();
    const rel = letter !== key;
    const [ox, oy] = rel ? cur : [0, 0];
    let ctrl = null;

    switch (key) {
      case 'M':
        cur = [a[0] + ox, a[1] + oy];
        start = cur;
        open(cur);
        break;
      case 'L': cur = [a[0] + ox, a[1] + oy]; push(T(cur[0], cur[1])); break;
      case 'H': cur = [a[0] + ox, cur[1]]; push(T(cur[0], cur[1])); break;
      case 'V': cur = [cur[0], a[0] + oy]; push(T(cur[0], cur[1])); break;
      case 'C':
      case 'S': {
        let c1;
        if (key === 'C') c1 = [a[0] + ox, a[1] + oy];
        else c1 = 'CS'.includes(prevCmd) && prevCtrl
          ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]]
          : cur;
        const c2 = key === 'C' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
        const end = key === 'C' ? [a[4] + ox, a[5] + oy] : [a[2] + ox, a[3] + oy];
        flattenCubic(push, T(cur[0], cur[1]), T(c1[0], c1[1]), T(c2[0], c2[1]), T(end[0], end[1]), tol);
        ctrl = c2;
        cur = end;
        break;
      }
      case 'Q':
      case 'T': {
        let q;
        if (key === 'Q') q = [a[0] + ox, a[1] + oy];
        else q = 'QT'.includes(prevCmd) && prevCtrl
          ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]]
          : cur;
        const end = key === 'Q' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
        // Élévation au degré trois : un seul aplatisseur à entretenir.
        const c1 = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
        const c2 = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])];
        flattenCubic(push, T(cur[0], cur[1]), T(c1[0], c1[1]), T(c2[0], c2[1]), T(end[0], end[1]), tol);
        ctrl = q;
        cur = end;
        break;
      }
      case 'A': {
        const end = [a[5] + ox, a[6] + oy];
        for (const [p0, p1, p2, p3] of arcToCubics(cur, a[0], a[1], (a[2] * Math.PI) / 180, !!a[3], !!a[4], end)) {
          flattenCubic(push, T(p0[0], p0[1]), T(p1[0], p1[1]), T(p2[0], p2[1]), T(p3[0], p3[1]), tol);
        }
        cur = end;
        break;
      }
      case 'Z':
        cur = start;
        break;
    }
    prevCtrl = ctrl;
    prevCmd = key;
  }
  if (ring && ring.length > 2) rings.push(ring);

  // Le point de fermeture, s'il double le point de départ, doit partir : la
  // fermeture est implicite et un doublon ferait une arête de longueur nulle.
  return rings.map((r) => {
    while (r.length > 3 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < minSeg) r.pop();
    return r;
  });
}

/* ── Outils de polygone ───────────────────────────────────────────────────── */
export const signedArea = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return s / 2;
};

export const bbox = (r) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of r) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

/** Point dans polygone, règle pair-impair. */
export function inside(r, x, y) {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Éléments de dessin d'un fichier SVG, avec leur matrice propre. */
export function elements(svg) {
  const out = [];
  const re = /<(path|circle|ellipse|rect)\b([^>]*)\/?>/g;
  let hit;
  while ((hit = re.exec(svg))) {
    const attrs = hit[2];
    const get = (n) => (attrs.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
    const style = get('style') || '';
    const m = parseTransform(get('transform') || (style.match(/transform:([^;"]*)/) || [])[1]);
    if (hit[1] === 'path') out.push({ tag: 'path', d: get('d'), m });
    else if (hit[1] === 'circle') {
      const [cx, cy, r] = [+(get('cx') || 0), +(get('cy') || 0), +get('r')];
      out.push({ tag: 'circle', d: `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`, m });
    }
  }
  return out;
}
