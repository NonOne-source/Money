import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
const FACE_VALUES = [1, 6, 2, 5, 3, 4];
const NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
function faceTexture(n: number, bump = false, skin = "classic") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bump ? "#bcbcbc" : skin === "ocean" ? "#bcebe4" : skin === "violet" ? "#dccafb" : "#f5f0e3";
  ctx.fillRect(0, 0, 256, 256);
  const spots: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ],
    5: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  };
  for (const [x, y] of spots[n]) {
    ctx.beginPath();
    ctx.arc(66 + x * 62, 66 + y * 62, 18, 0, Math.PI * 2);
    ctx.fillStyle = bump ? "#303030" : "#172937";
    ctx.fill();
    if (!bump) {
      ctx.beginPath();
      ctx.arc(65 + x * 62, 65 + y * 62, 11, Math.PI, Math.PI * 1.8);
      ctx.strokeStyle = "#435361";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = bump ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  return texture;
}
export function Dice({
  values,
  rollId,
  color,
  lowMotion = false,
  skin = "classic",
}: {
  values: [number, number] | null;
  rollId: number;
  color: string;
  lowMotion?: boolean;
  skin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const controller = useRef<
    ((v: [number, number], animate: boolean) => void) | null
  >(null);
  const latest = useRef({ values, rollId });
  latest.current = { values, rollId };
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, lowMotion ? 1 : 1.75),
    );
    renderer.shadowMap.enabled = !lowMotion;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0, 0);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 7, 6);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight("#f8f2dd", "#14293a", 3));
    const light = new THREE.DirectionalLight("#fff8e8", 4);
    light.position.set(-3, 8, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -5;
    scene.add(light);
    const rim = new THREE.PointLight(color, 9);
    rim.position.set(3, 2, -2);
    scene.add(rim);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.02;
    plane.receiveShadow = true;
    scene.add(plane);
    const materials = FACE_VALUES.map(
      (n) =>
        new THREE.MeshStandardMaterial({
          map: faceTexture(n, false, skin),
          bumpMap: faceTexture(n, true),
          bumpScale: 0.1,
          roughness: 0.32,
          metalness: 0.08,
        }),
    );
    const geometry = new RoundedBoxGeometry(1.08, 1.08, 1.08, 4, 0.1);
    const dice = [
      new THREE.Mesh(geometry, materials),
      new THREE.Mesh(geometry, materials),
    ];
    dice.forEach((d, i) => {
      d.position.set(i ? 0.86 : -0.86, 0.56, 0);
      d.castShadow = true;
      scene.add(d);
    });
    let raf = 0;
    const render = () => renderer.render(scene, camera);
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    });
    ro.observe(host);
    controller.current = (v, animate) => {
      cancelAnimationFrame(raf);
      const targets = v.map((value, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(
          NORMALS[FACE_VALUES.indexOf(value)],
          new THREE.Vector3(0, 1, 0),
        );
        return new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 1, 0), i ? 0.25 : -0.32)
          .multiply(q);
      });
      const variation = [Math.random(), Math.random()];
      const start = performance.now();
      function frame(now: number) {
        const t = animate && !lowMotion ? Math.min(1, (now - start) / 1700) : 1;
        dice.forEach((d, i) => {
          const sign = i ? 1 : -1;
          const progress = Math.min(1, t * (i ? 1 : 1.035));
          const damping = Math.pow(1-progress, 2);
          const bounce = Math.abs(Math.sin(progress*Math.PI*3.5)) * damping;
          d.position.set(sign*(.86 + damping*.8), .56+bounce*2.1,
            Math.sin(progress*Math.PI*2+i)*damping*.65);
          const turns = damping * Math.PI;
          const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(turns*(7+i+variation[i]*2),turns*(5+variation[i])*sign,turns*(4+variation[i])));
          d.quaternion.copy(spin).multiply(targets[i]);
          if(progress===1) {d.quaternion.copy(targets[i]);d.position.set(sign*.86,.56,0);}
        });
        render();
        if (t < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    };
    controller.current(latest.current.values || [3, 5], false);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.bumpMap?.dispose();
        m.dispose();
      });
      (plane.geometry as THREE.BufferGeometry).dispose();
      (plane.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      controller.current = null;
    };
  }, [lowMotion, color, skin]);
  const previous = useRef(rollId);
  useEffect(() => {
    controller.current?.(values || [3, 5], rollId !== previous.current);
    previous.current = rollId;
  }, [rollId, values?.[0], values?.[1]]);
  return (
    <div
      className={`dice-stage ${values?.[0] === values?.[1] && values ? "is-double" : ""}`}
      aria-label={
        values ? `Würfel ${values[0]} und ${values[1]}` : "Zwei 3D-Würfel"
      }
    >
      <div ref={ref} className="dice-canvas" />
      {fallback && (
        <div className="dice-fallback">
          {(values || [3, 5]).map((v, i) => (
            <span key={i}>{["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][v]}</span>
          ))}
        </div>
      )}
    </div>
  );
}
