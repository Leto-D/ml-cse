/**
 * Boule de Noël en bois : désassemblage piloté par le défilement.
 *
 * Ce fichier est le morceau lourd (three + fiber). Il n'est jamais chargé
 * directement : `scripts/bauble.ts` le tire par `import()` dynamique, et
 * seulement si le mouvement est autorisé et WebGL disponible.
 *
 * ── L'objet ───────────────────────────────────────────────────────────────
 * Deux plaques de bois collées face contre face, et elles ne jouent pas le
 * même rôle :
 *
 *   — la DÉCOUPE, devant. Une plaque ajourée dont les vides forment le décor :
 *     ligne d'arbres, ouverture centrale, petits motifs. Son dessin est de la
 *     matière retirée, pas une texture.
 *   — le FOND, derrière. Une plaque pleine, plus sombre, qu'on aperçoit à
 *     travers les ajours. Son recto porte le logo, placé exactement dans
 *     l'ouverture centrale. Son verso porte le bloc gravé — mention d'origine
 *     et nom de l'entreprise —, invisible tant que la boule est montée.
 *
 * ── Mécanique ─────────────────────────────────────────────────────────────
 * L'objet ne s'ouvre pas : il se désassemble, en éclaté latéral, en trois temps
 * enchaînés sans rupture.
 *
 *   1. Amorce (0 → 12 %). Les deux plaques se décollent de quelques
 *      millimètres dans l'épaisseur. C'est ce court instant qui dit qu'elles
 *      étaient collées, et sans lui l'écartement se lit comme un simple
 *      glissement. Il ouvre aussi la parallaxe entre la découpe et le fond.
 *   2. Écartement (10 % → 70 %). Elles partent en sens opposés à
 *      l'horizontale, toujours à distance dans l'épaisseur. La découpe garde
 *      sa face vers la caméra — c'est elle qu'on est venu voir — et ne reçoit
 *      qu'un balancement qui revient à zéro.
 *   3. Retournement (52 % → 100 %). Le FOND pivote de 180° sur son axe
 *      vertical : un demi-tour autour d'un axe vertical amène sa face −z en
 *      +z, donc son verso gravé finit face caméra. Il chevauche la fin de
 *      l'écartement, sinon le geste se lirait en deux animations.
 *
 * C'est là toute la révélation : ce qu'on découvre en séparant la boule, c'est
 * le dos gravé, qu'aucune position ne montrait avant.
 *
 * Le point à ne pas contourner : écarter les plaques le long de l'axe de la
 * caméra ne révélerait rien. Ici l'écartement est LATÉRAL, et c'est le
 * retournement du fond qui fait la révélation.
 *
 * L'écartement étant symétrique, le centroïde ne bouge pas : aucun recentrage
 * n'est nécessaire.
 *
 * La caméra ne bouge jamais. Le cadrage est tenu par l'échelle du groupe, ce
 * qui garde la perspective constante — registre photo produit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Group,
  LinearMipmapLinearFilter,
  MathUtils,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
} from 'three';
import type { DecorId } from '~/types';
import { buildPlate, FRAME, SIL, type PlateGeometry } from './shape';
import {
  composeCutFace,
  composeFondRecto,
  composeFondVerso,
  type WoodPalette,
} from './textures';

/* ════════════════════════════════════════════════════════════════════════ *
 *  BLOC DE CONSTANTES
 *  Régler le mouvement ou remplacer les visuels doit se faire ici, et
 *  nulle part ailleurs dans le fichier. La silhouette et le tracé des ajours
 *  ont le leur, dans `shape.ts` (SIL et LAYOUT).
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * `procedural` : textures dessinées au canevas → matériau éclairé.
 * `photo`      : photos de l'objet réel, dont l'éclairage est DÉJÀ cuit →
 *                matériau non éclairé et lumières coupées, sinon double ombrage.
 */
const MATERIAL_MODE: 'procedural' | 'photo' = 'procedural';

const GEO = {
  /** Épaisseur du bois, en rayons de corps. C'est elle qui vend le massif. */
  THICKNESS: 0.09,
};

const ANIM = {
  /** Amorce : décollement dans l'épaisseur, en rayons de corps. */
  UNSTICK_GAP: 0.16,
  /** Fin de l'amorce, en progression. */
  UNSTICK_END: 0.12,
  /** Début de l'écartement. Recouvre un peu l'amorce, sinon le geste se casse. */
  SPREAD_START: 0.1,
  /** Fin de l'écartement. Le retournement prend le relais avant elle. */
  SPREAD_END: 0.7,
  /** Demi-écart final entre les deux centres, en rayons de corps. */
  SPREAD: 1.1,
  /**
   * Début du retournement. Volontairement tardif : le disque du fond balaie
   * l'axe z en tournant, et tant que les deux plaques se recouvrent encore en
   * x, un retournement précoce les ferait se traverser. À 52 % l'écartement
   * est déjà fait aux quatre cinquièmes.
   */
  FLIP_START: 0.52,
  /** Retournement du fond : un demi-tour, pas moins. */
  FLIP: Math.PI,
  /** Balancement de la découpe. Nul au début et à la fin. */
  CUT_SWING: 0.3,
  /** Basculement trois quarts, maximal à 50 %, nul à 0 % et à 100 %. */
  TILT_Y: 0.24,
  TILT_X: 0.1,
  /** Amortissement du défilement. Plus grand = plus sec. */
  DAMP: 7,
  /** En deçà, on colle exactement à la cible : 0 et 1 sont atteints sans dérive. */
  SNAP: 0.0004,
};

const FIT = {
  /** Marge horizontale autour de l'encombrement (1 = plein cadre pile). */
  PAD_W: 1.08,
  /** Marge verticale. Un peu plus large : le basculement gagne en hauteur. */
  PAD_H: 1.14,
  /** Le basculement rapproche une partie de l'objet : un peu d'air en plus. */
  TILT_PAD: 0.12,
};

/**
 * Le plan proche est serré exprès. L'objet ne quitte jamais la tranche
 * z ∈ [−1,2 ; 1,2], donc il vit entre 3,4 et 5,8 de la caméra. Un plan proche à
 * 0,1 — la valeur par défaut qu'on recopie sans y penser — gaspille l'essentiel
 * de la précision du tampon de profondeur sur du vide : la répartition est
 * hyperbolique, et presque tous les bits partent entre 0,1 et 1. À 2,5 la
 * précision utile est multipliée par vingt, ce qui met les surfaces proches
 * — les deux plaques quand elles sont encore collées — hors de portée d'un
 * conflit de profondeur.
 */
const CAM = { FOV: 30, Z: 4.6, NEAR: 2.5, FAR: 8 };

/**
 * Filtrage anisotrope : le bois est un veinage fin, et le marquage placeholder
 * est un hachurage. Sous incidence rasante — c'est-à-dire pendant tout le
 * basculement — un filtrage trop faible les fait grésiller. 8 est le plafond
 * courant sur mobile.
 */
const TEX = { SIZE_DESKTOP: 1024, SIZE_MOBILE: 512, ANISOTROPY: 8 };

/** Tons du bois. La palette du site n'a pas de bois : ces valeurs sont locales. */
const WOOD: WoodPalette = {
  light: '#E8CFA6',
  mid: '#D8B489',
  dark: '#9A7146',
  burn: '#5C3E22',
  lip: '#F6E3C4',
  gold: '#C5A059',
};

const LIGHTS = {
  KEY_COLOR: '#FFE6C0',
  KEY_INTENSITY: 2.1,
  KEY_POSITION: [3.2, 4, 5.2] as [number, number, number],
  FILL_COLOR: '#FFF3E0',
  FILL_GROUND: '#5A4632',
  FILL_INTENSITY: 1.15,
  RIM_INTENSITY: 0.45,
  RIM_POSITION: [-4, 1.2, 2.4] as [number, number, number],
};

/* ════════════════════════════════════════════════════════════════════════ */

export interface BaubleProps {
  decor: DecorId;
  logoUrl?: string;
  companyName: string;
  /** Mention gravée au dos, révélée par le retournement du fond. */
  backEngraving: string;
  /** La plaque avant est-elle ajourée ? Faux = deux plaques pleines. */
  frontHasCutouts: boolean;
  /** Élément qui porte la hauteur défilable. La progression y est mesurée. */
  section: HTMLElement;
  /** Appelé à la première image effectivement rendue : masque le repli SVG. */
  onReady: () => void;
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Sensiblement linéaire au milieu, adouci aux deux bouts. Préféré au cubique
 * pour l'écartement : le cubique laisse le premier tiers du défilement presque
 * immobile, ce qui se lit comme un effet qui ne démarre pas.
 */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Ramène p, mesuré sur [a, b], dans [0, 1]. Sert à enchaîner les deux temps. */
const range = (p: number, a: number, b: number) =>
  p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a);

/* ---------------------------------------------------------------- *
 * Progression du défilement
 * Écrite dans un ref, jamais dans un state : aucun rendu React par image.
 * ---------------------------------------------------------------- */
function useScrollProgress(section: HTMLElement) {
  const progress = useRef(0);

  useEffect(() => {
    const compute = () => {
      const r = section.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const raw = travel <= 0 ? 0 : -r.top / travel;
      progress.current = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    };
    compute();
    // Passif : la scène LIT la position, elle ne la contrôle pas. Aucun
    // preventDefault, ni sur la molette ni sur le tactile.
    window.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [section]);

  return progress;
}

/* ---------------------------------------------------------------- *
 * Chargement du logo
 * `crossOrigin` obligatoire : un canevas contaminé est refusé par WebGL.
 * En cas de 404 ou de refus CORS on retombe silencieusement sur la marque
 * placeholder neutre — jamais sur le logo d'une entreprise réelle.
 * ---------------------------------------------------------------- */
function loadLogo(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function makeTexture(canvas: HTMLCanvasElement, anisotropy: number) {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

interface Kit {
  /** Les deux faces de la plaque ajourée : même planche, même texture. */
  cutFace: Material;
  /** Le fond, côté caméra. Aperçu par les ajours. */
  fondRecto: Material;
  /** Le dos gravé. C'est la récompense du défilement. */
  fondVerso: Material;
  /** Toutes les parois : contour, œillet, ajours. */
  edge: Material;
  dispose: () => void;
}

/* ---------------------------------------------------------------- *
 * Matériaux
 * ---------------------------------------------------------------- */
function buildKit(
  spec: Omit<BaubleProps, 'section' | 'onReady'>,
  logo: HTMLImageElement | null,
  size: number,
  anisotropy: number,
): Kit {
  const base = {
    decor: spec.decor,
    logo,
    companyName: spec.companyName,
    backEngraving: spec.backEngraving,
    palette: WOOD,
    size,
  };

  const maps = [
    makeTexture(composeCutFace(base), anisotropy),
    makeTexture(composeFondRecto(base), anisotropy),
    makeTexture(composeFondVerso(base), anisotropy),
  ];

  const lit = MATERIAL_MODE === 'procedural';
  const face = (map: Texture): Material =>
    lit
      ? new MeshStandardMaterial({ map, metalness: 0, roughness: 0.78 })
      : new MeshBasicMaterial({ map });

  // Les parois : plus sombres et plus mates que les faces. Ce sont elles qui
  // rendent l'objet massif plutôt qu'imprimé, et elles sont partout — le
  // moindre ajour en montre une.
  const edge: Material = lit
    ? new MeshStandardMaterial({ color: WOOD.dark, metalness: 0, roughness: 0.92 })
    : new MeshBasicMaterial({ color: WOOD.dark });

  const mats = [face(maps[0]), face(maps[1]), face(maps[2]), edge];

  return {
    cutFace: mats[0],
    fondRecto: mats[1],
    fondVerso: mats[2],
    edge,
    dispose: () => {
      mats.forEach((m) => m.dispose());
      maps.forEach((t) => t.dispose());
    },
  };
}

/* ---------------------------------------------------------------- *
 * Une plaque : deux faces et toutes les parois.
 * `zPlus` / `zMinus` désignent les côtés, pas leur rôle.
 * ---------------------------------------------------------------- */
function Plate({
  geo,
  zPlus,
  zMinus,
  edge,
}: {
  geo: PlateGeometry;
  zPlus: Material;
  zMinus: Material;
  edge: Material;
}) {
  const T = GEO.THICKNESS;
  return (
    <group>
      <mesh geometry={geo.face} material={zPlus} position={[0, 0, T / 2]} />
      {/* Tournée d'un demi-tour : sa rotation annule celle de la plaque quand
          celle-ci se retourne, et le texte gravé se lit alors à l'endroit. */}
      <mesh
        geometry={geo.face}
        material={zMinus}
        position={[0, 0, -T / 2]}
        rotation={[0, Math.PI, 0]}
      />
      <mesh geometry={geo.edge} material={edge} />
    </group>
  );
}

/* ---------------------------------------------------------------- *
 * La scène
 * ---------------------------------------------------------------- */
function Bauble({ section, onReady, ...spec }: BaubleProps) {
  const stage = useRef<Group>(null);
  const cut = useRef<Group>(null);
  const fond = useRef<Group>(null);
  // −1 = pas encore initialisé. Au premier rendu on colle à la progression
  // réelle : recharger la page au milieu de la section ne doit pas rejouer le
  // désassemblage depuis le début.
  const smoothed = useRef(-1);
  const frames = useRef(0);

  const progress = useScrollProgress(section);
  const gl = useThree((s) => s.gl);

  const [kit, setKit] = useState<Kit | null>(null);

  // La géométrie ne dépend que du tracé : elle se construit sans attendre le
  // logo, contrairement aux textures.
  const geo = useMemo(() => {
    const fond = buildPlate(spec.decor, false, GEO.THICKNESS);
    // Sans ajours, les deux plaques ont exactement la même forme : on partage
    // le tampon plutôt que d'en construire deux identiques.
    const cut = spec.frontHasCutouts
      ? buildPlate(spec.decor, true, GEO.THICKNESS)
      : fond;
    return { cut, fond };
  }, [spec.decor, spec.frontHasCutouts]);

  useEffect(
    () => () => {
      geo.cut.dispose();
      if (geo.fond !== geo.cut) geo.fond.dispose();
    },
    [geo],
  );

  useEffect(() => {
    let cancelled = false;
    let current: Kit | null = null;
    const size = window.innerWidth < 768 ? TEX.SIZE_MOBILE : TEX.SIZE_DESKTOP;
    const aniso = Math.min(TEX.ANISOTROPY, gl.capabilities.getMaxAnisotropy());

    loadLogo(spec.logoUrl).then((logo) => {
      if (cancelled) return;
      current = buildKit(spec, logo, size, aniso);
      setKit(current);
    });

    return () => {
      cancelled = true;
      current?.dispose();
    };
    // Recomposer sur ces entrées seulement : c'est le point d'insertion exact
    // du futur configurateur (redessiner, puis `needsUpdate`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.decor, spec.logoUrl, spec.companyName, spec.backEngraving, gl]);

  useFrame((state, delta) => {
    if (!stage.current || !cut.current || !fond.current) return;

    const target = progress.current;
    if (smoothed.current < 0) smoothed.current = target;
    let s = MathUtils.damp(smoothed.current, target, ANIM.DAMP, delta);
    // Sans ce collage, l'amortissement laisse un résidu : la boule ne serait
    // jamais tout à fait assemblée en haut, ni tout à fait éclatée en bas.
    if (Math.abs(s - target) < ANIM.SNAP) s = target;
    smoothed.current = s;

    const T = GEO.THICKNESS;
    const R = SIL.R;

    // Temps 1 : le décollement dans l'épaisseur.
    const unstick = easeInOutCubic(range(s, 0, ANIM.UNSTICK_END));
    // Temps 2 : l'écartement latéral.
    const spread = easeInOutSine(range(s, ANIM.SPREAD_START, ANIM.SPREAD_END));
    // Temps 3 : le retournement, qui chevauche la fin de l'écartement.
    const flip = easeInOutSine(range(s, ANIM.FLIP_START, 1));

    /*
      Le jeu dans l'épaisseur s'ouvre pendant l'amorce, reste ouvert pendant
      TOUT le glissement, et ne se referme que sur le retournement.

      Ce n'est pas cosmétique. En tournant, le disque du fond balaie l'axe z de
      part et d'autre de son plan, jusqu'à un rayon entier. Tant que les deux
      plaques se recouvrent encore en x, seule cette distance les empêche de se
      traverser. Refermer le jeu sur l'écartement, comme le voudrait l'intuition,
      les fait s'interpénétrer autour de 35 % — un défaut qu'aucun réglage de
      lumière ne rattrape.

      À l'arrivée le jeu est nul : les deux groupes sont à z = 0, donc les deux
      faces montrées sont exactement coplanaires.
    */
    const sep = (T / 2 + R * ANIM.UNSTICK_GAP * unstick) * (1 - flip);
    const shift = R * ANIM.SPREAD * spread;

    // La découpe reste face caméra : c'est le dessin qu'on est venu voir.
    cut.current.position.set(-shift, 0, sep);
    cut.current.rotation.y = ANIM.CUT_SWING * Math.sin(Math.PI * spread);

    // Le fond se retourne et livre son dos gravé.
    fond.current.position.set(shift, 0, -sep);
    fond.current.rotation.y = ANIM.FLIP * flip;

    // Nul à 0 et à 1, maximal à 50 % : le basculement fait partie du même
    // mouvement continu, ce n'est pas une seconde animation.
    const tilt = Math.sin(Math.PI * s);
    stage.current.rotation.y = ANIM.TILT_Y * tilt;
    stage.current.rotation.x = ANIM.TILT_X * tilt;

    /*
      Cadrage. La caméra ne bouge pas : c'est le groupe qui s'adapte, donc la
      perspective reste constante du début à la fin.

      L'encombrement horizontal est MAJORÉ — chaque plaque compte pour sa
      largeur pleine, même quand elle est de chant. Créditer le raccourci
      donnerait quelques pour cent de plus au milieu du retournement, mais
      l'encombrement cesserait d'être monotone et l'objet grossirait en cours
      de route. Ici `span` ne peut que croître, donc l'échelle ne peut que
      décroître.

      La réserve pour le basculement ne s'applique qu'à la hauteur, pour la
      même raison : elle se relâche en fin de course, et l'appliquer aussi à la
      largeur rendrait le dernier tiers légèrement zoomant.
    */
    const span = 2 * shift + 2 * R;
    const air = 1 + FIT.TILT_PAD * tilt;
    stage.current.scale.setScalar(
      Math.min(
        state.viewport.width / (span * FIT.PAD_W),
        state.viewport.height / (2 * FRAME.HALF * FIT.PAD_H * air),
      ),
    );

    if (kit && frames.current < 2 && ++frames.current === 2) onReady();
  });

  if (!kit) return null;

  const T = GEO.THICKNESS;

  return (
    <>
      {MATERIAL_MODE === 'procedural' && (
        <>
          <hemisphereLight
            args={[LIGHTS.FILL_COLOR, LIGHTS.FILL_GROUND, LIGHTS.FILL_INTENSITY]}
          />
          <directionalLight
            color={LIGHTS.KEY_COLOR}
            intensity={LIGHTS.KEY_INTENSITY}
            position={LIGHTS.KEY_POSITION}
          />
          <directionalLight
            color={LIGHTS.FILL_COLOR}
            intensity={LIGHTS.RIM_INTENSITY}
            position={LIGHTS.RIM_POSITION}
          />
        </>
      )}

      <group ref={stage}>
        {/* Le fond. Recto vers la caméra — c'est lui qu'on aperçoit par les
            ajours —, verso gravé, que le retournement révèle. */}
        <group ref={fond} position={[0, 0, -T / 2]}>
          <Plate
            geo={geo.fond}
            zPlus={kit.fondRecto}
            zMinus={kit.fondVerso}
            edge={kit.edge}
          />
        </group>
        {/* La découpe. Son décor est dans la géométrie : les vides. */}
        <group ref={cut} position={[0, 0, T / 2]}>
          <Plate
            geo={geo.cut}
            zPlus={kit.cutFace}
            zMinus={kit.cutFace}
            edge={kit.edge}
          />
        </group>
      </group>
    </>
  );
}

/* ---------------------------------------------------------------- *
 * Le canevas
 * ---------------------------------------------------------------- */
export default function BaubleCanvas(props: BaubleProps) {
  const [active, setActive] = useState(true);

  // Hors écran, la boucle de rendu est coupée net : coût GPU nul.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      rootMargin: '120px',
    });
    io.observe(props.section);
    return () => io.disconnect();
  }, [props.section]);

  const dpr: [number, number] = window.innerWidth < 768 ? [1, 1.5] : [1, 2];

  return (
    <Canvas
      dpr={dpr}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: CAM.FOV, position: [0, 0, CAM.Z], near: CAM.NEAR, far: CAM.FAR }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <Bauble {...props} />
    </Canvas>
  );
}
