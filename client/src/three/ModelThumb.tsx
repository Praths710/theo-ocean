import { useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MODEL_CONFIG, SPECIES_MODEL, type ModelId } from "./modelConfig";
import { builtScene } from "./ModelActor";

// Small still pictures of the 3D models for card grids (the collection, the expedition map).
// A live 3D view per card would need one WebGL context each (browsers allow ~16), so every model
// is rendered once by a single shared off-screen renderer and reused as an image.

const W = 320, H = 200;
let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<ModelId, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  }
  return renderer;
}

async function render(id: ModelId): Promise<string | null> {
  const cfg = MODEL_CONFIG[id];
  const model = cfg.build ? builtScene(id).clone(true) : (await loader.loadAsync(cfg.file!)).scene;
  model.rotation.set(...cfg.rot);
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.y = -0.45; // three-quarter view
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder, true);
  const size = box.getSize(new THREE.Vector3());
  const s = 2 / Math.max(size.x, size.y * (W / H), 1e-6);
  holder.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  holder.position.sub(new THREE.Box3().setFromObject(holder, true).getCenter(new THREE.Vector3()));
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (cfg.tint && mat.color) mat.color.multiply(new THREE.Color(cfg.tint));
      if (cfg.emissive && mat.emissive) { mat.emissive = new THREE.Color(cfg.emissive); mat.emissiveIntensity = cfg.emissiveIntensity ?? 0.6; }
    }
  });
  const scene = new THREE.Scene();
  scene.add(holder, new THREE.HemisphereLight("#cdf6ff", "#0b2a3a", 1.3));
  const key = new THREE.DirectionalLight("#fff4e0", 2.4); key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight("#62e0ff", 1.3); rim.position.set(-4, 1, -3);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  camera.position.set(0, 0.25, 4.2);
  camera.lookAt(0, 0, 0);
  const r = getRenderer();
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL("image/webp", 0.85); // falls back to PNG where WebP encoding is unsupported
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) { mat.map?.dispose(); mat.dispose(); }
  });
  return url;
}

/** A cached picture of the model (rendered one at a time), or null if WebGL/loading fails. */
// Snapshots are kept in the browser between visits, so the home screen doesn't reload and
// re-render every model each time (bump the version when the models or lighting change).
const STORE_KEY = (id: ModelId) => `theo-thumb-v3:${id}`;
function stored(id: ModelId) {
  try { return localStorage.getItem(STORE_KEY(id)); } catch { return null; }
}
function store(id: ModelId, url: string | null) {
  if (!url) return;
  try { localStorage.setItem(STORE_KEY(id), url); } catch { /* storage full or blocked: render again next time */ }
}

export function modelSnapshot(id: ModelId): Promise<string | null> {
  let p = cache.get(id);
  const saved = p ? null : stored(id);
  if (!p && saved) {
    p = Promise.resolve(saved);
    cache.set(id, p);
  }
  if (!p) {
    p = queue.then(() => render(id)).then((url) => { store(id, url); return url; }).catch(() => null);
    queue = p;
    cache.set(id, p);
  }
  return p;
}

export default function ModelThumb({ speciesId, fallback, className, alt = "" }: { speciesId: string; fallback: ReactNode; className?: string; alt?: string }) {
  const id = SPECIES_MODEL[speciesId] as ModelId | undefined;
  const [src, setSrc] = useState<string | null | undefined>(undefined); // undefined = still rendering
  useEffect(() => {
    if (!id) return;
    let live = true;
    void modelSnapshot(id).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [id]);
  if (id && src === undefined) return <span className={`thumb-loading ${className ?? ""}`} aria-hidden="true" />;
  if (!id || !src) return <>{fallback}</>;
  return <img className={className} src={src} alt={alt} draggable={false} />;
}
