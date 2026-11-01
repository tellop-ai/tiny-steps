'use client';

/**
 * Toy room's 3D scene: a round rug on a soft floor, toys shaped like solids
 * standing round it, lit from the upper left with soft shadows. The game hands
 * in three.js itself (it loads it only when this game opens, so no other page
 * carries it).
 *
 * Each toy has a tap target in the page (`spots`, real elements with a role and
 * a label); the loop moves each target over its toy every frame through the
 * CSSOM, so a press, a key or a screen reader reaches the toy the eye sees.
 *
 * Colours are the look's tokens, read at run time (AGENTS.md "3D scenes"):
 * the page, the floor, the rug, its edge and six toy colours. Lights keep
 * three's own neutral white. Nothing is written as a colour here.
 */

import { RUG_RADIUS, TOY_RADIUS, rugPlaces } from '../../lib/games/toy-room.js';

/** The tokens the scene paints with. */
const TOKENS = Object.freeze({
  background: '--background',
  floor: '--muted',
  rug: '--secondary',
  rugEdge: '--primary',
  toys: Object.freeze(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--accent']),
});

/**
 * The camera looks down at the rug from this many degrees above the floor on a
 * wide stage, and more steeply on a tall one (a phone), so the rug fills more of it.
 */
const PITCH_DEG = 40;
const PITCH_TALL_DEG = 52;
/** The camera's up-down view angle, in degrees. */
const FOV_DEG = 38;
/** How far the turning rug goes by itself (Hard), in radians a second. */
const TURN_SPEED = 0.2;
/** After a person turns the rug, it waits this long before turning by itself again, in seconds. */
const TURN_REST = 2.5;
/** A toy's own slow turn on the spot, in radians a second. */
const SPIN_SPEED = 0.45;
/** The smallest tap target, in pixels (about 3.5 rem). */
const MIN_SPOT_PX = 56;
/** How much of the stage the rug and its toys may fill, across and up-down (the rest is a margin). */
const FILL_ACROSS = 0.92;
const FILL_UP = 0.86;
/** The highest point the fit keeps in view above the rug: a toy's top part-way through its hop. */
const FIT_TOP = 1.5;

/** Each solid: its height (it stands on the rug) and how it is made. */
const SOLID_HEIGHT = Object.freeze({ ball: 1, cube: 0.86, cone: 1, cylinder: 0.92, pyramid: 0.95, ring: 0.36 });

const easeOutBack = (t) => {
  const c = 1.6;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * One token as a three.js colour. The page's own canvas turns any CSS colour
 * into sRGB bytes, which three wants as linear values.
 */
function tokenColour(THREE, probe, root, name) {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  if (!value || !CSS.supports('color', value)) throw new Error(`toy room: token ${name} is not a colour`);
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function readPalette(THREE, root) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const probe = canvas.getContext('2d', { willReadFrequently: true });
  const read = (name) => tokenColour(THREE, probe, root, name);
  return {
    background: read(TOKENS.background),
    floor: read(TOKENS.floor),
    rug: read(TOKENS.rug),
    rugEdge: read(TOKENS.rugEdge),
    toys: TOKENS.toys.map(read),
  };
}

/**
 * The rug's top, like a play rug: rings and a round middle in deeper tones of the
 * rug, mixed toward its edge colour. Painted once on a small canvas.
 */
function rugPattern(THREE, palette) {
  const size = 512;
  const middle = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const paint = canvas.getContext('2d');
  const deeper = (share) => palette.rug.clone().lerp(palette.rugEdge, share).getStyle(THREE.SRGBColorSpace);
  paint.fillStyle = palette.rug.getStyle(THREE.SRGBColorSpace);
  paint.fillRect(0, 0, size, size);
  const ring = (radius, width, share) => {
    paint.beginPath();
    paint.arc(middle, middle, radius * middle, 0, Math.PI * 2);
    paint.lineWidth = width * middle;
    paint.strokeStyle = deeper(share);
    paint.stroke();
  };
  const disc = (radius, share) => {
    paint.beginPath();
    paint.arc(middle, middle, radius * middle, 0, Math.PI * 2);
    paint.fillStyle = deeper(share);
    paint.fill();
  };
  ring(0.86, 0.035, 0.22);
  ring(0.62, 0.02, 0.16);
  disc(0.3, 0.1);
  ring(0.3, 0.025, 0.24);
  disc(0.1, 0.2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** The geometry of each solid, made once; each sits with its base on y = 0. */
function makeGeometries(THREE, RoundedBoxGeometry) {
  const lift = (geometry, height) => geometry.translate(0, height / 2, 0);
  const pyramid = new THREE.ConeGeometry(0.62, SOLID_HEIGHT.pyramid, 4).toNonIndexed();
  pyramid.rotateY(Math.PI / 4);
  pyramid.computeVertexNormals();
  // The ring lies flat, like a stacking ring: standing on its edge it showed as a thin line.
  const ring = new THREE.TorusGeometry(0.4, 0.18, 24, 72).rotateX(Math.PI / 2);
  return {
    ball: lift(new THREE.SphereGeometry(0.5, 48, 32), SOLID_HEIGHT.ball),
    cube: lift(new RoundedBoxGeometry(0.86, 0.86, 0.86, 4, 0.09), SOLID_HEIGHT.cube),
    cone: lift(new THREE.ConeGeometry(0.5, SOLID_HEIGHT.cone, 56), SOLID_HEIGHT.cone),
    cylinder: lift(new THREE.CylinderGeometry(0.42, 0.42, SOLID_HEIGHT.cylinder, 56), SOLID_HEIGHT.cylinder),
    pyramid: lift(pyramid, SOLID_HEIGHT.pyramid),
    ring: ring.translate(0, 0.18, 0),
  };
}

/**
 * Builds the scene on a canvas of its own, put first in `stage` and sized to it.
 * Each scene gets a new canvas, because a drawing context once given back cannot
 * draw again. If building fails part-way, everything made so far is given back
 * and the error goes on to the caller.
 *
 * @param {{
 *   THREE: any,
 *   RoundedBoxGeometry: any,
 *   RoomEnvironment: any,
 *   stage: HTMLElement,
 *   spots: Map<string, HTMLElement>,
 *   still: boolean,
 *   turning: boolean,
 *   onFrames?: (count: number) => void,
 * }} options  still: the person asked for less motion; turning: the rug turns by itself
 */
export function createToyScene(options) {
  const { THREE, stage } = options;
  const palette = readPalette(THREE, document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.className = 'ty-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const disposables = [];
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    return buildScene({ ...options, palette, canvas, renderer, disposables });
  } catch (error) {
    for (const thing of disposables) thing.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    canvas.remove();
    throw error;
  }
}

function buildScene({ THREE, RoundedBoxGeometry, RoomEnvironment, palette, canvas, renderer, disposables, stage, spots, still, turning, onFrames }) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = palette.background;
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 80);

  const keep = (thing) => {
    disposables.push(thing);
    return thing;
  };

  // A soft room's light, reflected in the toys' glaze only (on the floor and the rug it washes
  // their colour out); three's own neutral room, no colour of ours.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const reflection = keep(pmrem.fromScene(room, 0.04)).texture;
  room.dispose();
  pmrem.dispose();

  const sky = new THREE.HemisphereLight();
  sky.intensity = 1.5;
  const sun = new THREE.DirectionalLight();
  sun.intensity = 2;
  sun.position.set(-2.6, 8, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 16 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sky, sun, sun.target);
  // The sun's shadow picture is a texture of its own.
  keep(sun);

  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(40, 40)), keep(new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 1 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  scene.add(floor);

  // The rug turns, and the toys stand on it.
  const turntable = new THREE.Group();
  scene.add(turntable);
  const rugSize = RUG_RADIUS + TOY_RADIUS + 0.35;
  const plainRug = keep(new THREE.MeshStandardMaterial({ color: palette.rug, roughness: 0.92 }));
  const rugTop = keep(new THREE.MeshStandardMaterial({ map: keep(rugPattern(THREE, palette)), roughness: 0.92 }));
  // A cylinder's parts are its side, its top and its bottom; only the top shows the pattern.
  const rug = new THREE.Mesh(keep(new THREE.CylinderGeometry(rugSize, rugSize, 0.08, 96)), [plainRug, rugTop, plainRug]);
  rug.position.y = -0.04;
  rug.receiveShadow = true;
  const edge = new THREE.Mesh(keep(new THREE.TorusGeometry(rugSize, 0.045, 12, 128)), keep(new THREE.MeshStandardMaterial({ color: palette.rugEdge, roughness: 0.7 })));
  edge.rotation.x = Math.PI / 2;
  turntable.add(rug, edge);

  const geometries = makeGeometries(THREE, RoundedBoxGeometry);
  for (const geometry of Object.values(geometries)) keep(geometry);
  const glaze = (color) =>
    keep(new THREE.MeshPhysicalMaterial({ color, roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3, envMap: reflection, envMapIntensity: 0.4 }));
  const toyMaterials = palette.toys.map(glaze);
  const dimMaterials = palette.toys.map((color) => keep(new THREE.MeshStandardMaterial({ color: color.clone().lerp(palette.floor, 0.68), roughness: 0.85 })));
  const flatMaterials = new Map();

  /** @type {Map<string, { holder: any, body: any, kind: string, colour: number, phase: number, born: number, hop: number, wobble: number, dim: boolean }>} */
  const toys = new Map();
  let clock = 0;

  function materialFor(kind, colour, dim) {
    const base = dim ? dimMaterials[colour] : toyMaterials[colour];
    if (kind !== 'pyramid') return base;
    // A pyramid's faces stay flat.
    const key = `${colour}-${dim}`;
    if (!flatMaterials.has(key)) {
      const flat = base.clone();
      flat.flatShading = true;
      flatMaterials.set(key, keep(flat));
    }
    return flatMaterials.get(key);
  }

  function clearToys() {
    for (const toy of toys.values()) turntable.remove(toy.holder);
    toys.clear();
  }

  /** Puts a round's toys on the rug; they pop up one after another. */
  function show(round) {
    clearToys();
    const places = rugPlaces(round.toys.length);
    round.toys.forEach((spec, at) => {
      const holder = new THREE.Group();
      holder.position.set(places[at].x, 0, places[at].z);
      const body = new THREE.Mesh(geometries[spec.kind], materialFor(spec.kind, spec.colour, false));
      body.castShadow = true;
      body.receiveShadow = true;
      // Each toy starts turned a little differently, so a cube shows an edge and a ring its side now and then.
      body.rotation.y = (at * 1.3) % (Math.PI * 2);
      holder.add(body);
      turntable.add(holder);
      toys.set(spec.id, { holder, body, kind: spec.kind, colour: spec.colour, phase: at * 1.7, born: clock + at * 0.09, hop: -1, wobble: -1, dim: false });
    });
  }

  function hop(id) {
    const toy = toys.get(id);
    if (toy) toy.hop = clock;
  }
  function wobble(id) {
    const toy = toys.get(id);
    if (toy) toy.wobble = clock;
  }
  function dim(id) {
    const toy = toys.get(id);
    if (!toy || toy.dim) return;
    toy.dim = true;
    toy.body.material = materialFor(toy.kind, toy.colour, true);
  }
  let restUntil = 0;
  function turnBy(radians) {
    if (!Number.isFinite(radians)) return;
    turntable.rotation.y += radians;
    restUntil = clock + TURN_REST;
  }

  /** The loop runs only while the page shows, the grown-ups window is closed and the run goes on. */
  let running = false;
  let paused = false;
  let frozen = false;

  // The camera backs off until the rug and its toys fill the stage, however narrow, and the
  // rug sits in the middle. Points round the rug's edge and round the toys' tops are projected
  // and the view is moved and scaled; a few passes settle it (the view is a perspective).
  const fitPoints = [];
  for (let at = 0; at < 32; at += 1) {
    const angle = (at / 32) * Math.PI * 2;
    fitPoints.push(new THREE.Vector3(Math.cos(angle) * (rugSize + 0.05), 0, Math.sin(angle) * (rugSize + 0.05)));
    fitPoints.push(new THREE.Vector3(Math.cos(angle) * (RUG_RADIUS + TOY_RADIUS * 0.6), FIT_TOP, Math.sin(angle) * (RUG_RADIUS + TOY_RADIUS * 0.6)));
  }
  const toCamera = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const aim = (distance) => {
    camera.position.copy(look).addScaledVector(toCamera, distance);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  };
  const fit = () => {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(PITCH_DEG + (1.3 - camera.aspect) * 30, PITCH_DEG, PITCH_TALL_DEG));
    toCamera.set(0, Math.sin(pitch), Math.cos(pitch));
    cameraUp.set(0, Math.cos(pitch), -Math.sin(pitch));
    const halfUp = Math.tan(THREE.MathUtils.degToRad(FOV_DEG / 2));
    look.set(0, 0.4, 0);
    let distance = 10;
    for (let pass = 0; pass < 6; pass += 1) {
      aim(distance);
      let left = Infinity;
      let right = -Infinity;
      let bottom = Infinity;
      let top = -Infinity;
      for (const point of fitPoints) {
        probe.copy(point).project(camera);
        left = Math.min(left, probe.x);
        right = Math.max(right, probe.x);
        bottom = Math.min(bottom, probe.y);
        top = Math.max(top, probe.y);
      }
      look.addScaledVector(cameraUp, ((top + bottom) / 2) * distance * halfUp);
      distance *= Math.max((right - left) / (2 * FILL_ACROSS), (top - bottom) / (2 * FILL_UP));
    }
    aim(distance);
    // A new size clears the canvas; while the loop rests, draw the still picture again.
    if (!running) renderer.render(scene, camera);
  };
  fit();
  const watcher = new ResizeObserver(fit);
  watcher.observe(stage);

  const centre = new THREE.Vector3();
  const side = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  /** Where each tap target was put last, so it is written only when it moves by half a pixel or more. */
  const placed = new WeakMap();
  /** Moves each tap target over its toy, through CSS variables the stylesheet reads. */
  function placeSpots() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    sideways.setFromMatrixColumn(camera.matrixWorld, 0);
    for (const [id, toy] of toys) {
      const spot = spots.get(id);
      if (!spot) continue;
      toy.holder.updateWorldMatrix(true, false);
      centre.set(0, SOLID_HEIGHT[toy.kind] / 2, 0).applyMatrix4(toy.holder.matrixWorld);
      side.copy(centre).addScaledVector(sideways, TOY_RADIUS * 1.12);
      centre.project(camera);
      side.project(camera);
      const x = ((centre.x + 1) / 2) * width;
      const y = ((1 - centre.y) / 2) * height;
      const size = Math.max(MIN_SPOT_PX, Math.abs(side.x - centre.x) * width);
      const last = placed.get(spot);
      if (last && Math.abs(last[0] - x) < 0.5 && Math.abs(last[1] - y) < 0.5 && Math.abs(last[2] - size) < 0.5) continue;
      placed.set(spot, [x, y, size]);
      spot.style.setProperty('--ty-size', `${size.toFixed(1)}px`);
      spot.style.setProperty('--ty-x', `${(x - size / 2).toFixed(1)}px`);
      spot.style.setProperty('--ty-y', `${(y - size / 2).toFixed(1)}px`);
      if (spot.dataset.placed !== 'true') spot.dataset.placed = 'true';
    }
  }

  let frames = 0;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock += dt;
    if (turning && !still && clock >= restUntil) turntable.rotation.y += TURN_SPEED * dt;
    for (const toy of toys.values()) {
      const { holder, body } = toy;
      let lift = 0;
      let scale = 1;
      let tilt = 0;
      let extraSpin = 0;
      if (!still) {
        const age = clock - toy.born;
        scale = age <= 0 ? 0.001 : age < 0.45 ? Math.max(0.001, easeOutBack(age / 0.45)) : 1;
        lift = toy.dim ? 0 : 0.035 * (1 + Math.sin(clock * 2.1 + toy.phase));
        body.rotation.y += SPIN_SPEED * dt * (toy.dim ? 0 : 1);
        if (toy.hop >= 0) {
          const t = Math.min(1, (clock - toy.hop) / 0.75);
          lift += 0.85 * Math.sin(Math.PI * t);
          extraSpin = Math.PI * 2 * easeInOut(t);
        }
        if (toy.wobble >= 0) {
          const t = Math.min(1, (clock - toy.wobble) / 0.5);
          tilt = 0.32 * Math.sin(t * Math.PI * 6) * (1 - t);
          if (t >= 1) {
            toy.wobble = -1;
            dim(findId(toy));
          }
        }
      } else if (toy.wobble >= 0) {
        toy.wobble = -1;
        dim(findId(toy));
      }
      holder.position.y = lift;
      holder.scale.setScalar(scale);
      holder.rotation.set(0, extraSpin, tilt);
    }
    renderer.render(scene, camera);
    placeSpots();
    frames += 1;
    if (onFrames && frames % 10 === 1) onFrames(frames);
  };
  function findId(toy) {
    for (const [id, value] of toys) if (value === toy) return id;
    return null;
  }

  const run = (on) => {
    if (on === running) return;
    running = on;
    last = performance.now();
    renderer.setAnimationLoop(on ? frame : null);
  };
  const update = () => run(!document.hidden && !paused && !frozen);
  document.addEventListener('visibilitychange', update);
  update();

  return {
    show,
    hop,
    wobble,
    dim,
    turnBy,
    /** Holds everything still while the grown-ups window is open; the rug does not turn by itself. */
    pause(on) {
      paused = Boolean(on);
      update();
    },
    /** Stops the loop for good; the last frame stays on the screen (the run is over). */
    freeze() {
      frozen = true;
      update();
    },
    /** Stops the loop and gives back everything the scene made, its drawing context and its canvas. */
    dispose() {
      document.removeEventListener('visibilitychange', update);
      run(false);
      watcher.disconnect();
      clearToys();
      for (const thing of disposables) thing.dispose();
      renderer.dispose();
      // Giving the drawing context back keeps the browser's few contexts free; this canvas never draws again.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
