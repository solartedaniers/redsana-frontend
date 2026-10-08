import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { ThemeService } from '../../../core/theme/theme.service';
import { NETWORK_BACKGROUND_CONFIG } from './network-background.config';

const { scene: SCENE, motion: MOTION, parallax: PARALLAX } = NETWORK_BACKGROUND_CONFIG;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const MS_PER_SECOND = 1000;

interface NodeUserData {
  origin: THREE.Vector3;
  speed: number;
  phase: number;
}

// Decorative constellation of connected nodes (a home network topology) that
// lives only on the public screens (landing and auth). It lives in AuthLayout,
// not in each screen, so the scene is not rebuilt when navigating between them.
// It follows the mouse with a lerped parallax, drifts slowly on touch screens,
// pauses while the tab is hidden and falls back to a static frame when WebGL
// is unavailable or the user prefers reduced motion.
@Component({
  selector: 'app-network-background',
  templateUrl: './network-background.html',
  styleUrl: './network-background.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-static]': 'webglUnavailable()' },
})
export class NetworkBackground {
  private readonly theme = inject(ThemeService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly webglUnavailable = signal(false);

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private readonly group = new THREE.Group();
  private readonly nodes: THREE.Mesh[] = [];
  private readonly nodeGeometry = new THREE.SphereGeometry(SCENE.nodeRadius, 12, 12);
  private readonly nodeMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly hubGeometry = new THREE.OctahedronGeometry(SCENE.hubRadius, 1);
  private readonly hubMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  private hub?: THREE.Mesh;
  private readonly lineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: SCENE.lineOpacity });
  private readonly lineGeometry = new THREE.BufferGeometry();
  private readonly rings: THREE.Mesh[] = [];

  private animationFrameId: number | null = null;
  private lastFrameTime: number | null = null;
  private frameCount = 0;
  private elapsed = 0;
  private pointerTargetX = 0;
  private pointerTargetY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private reducedMotion?: MediaQueryList;
  private finePointer?: MediaQueryList;
  private resizeObserver?: ResizeObserver;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Recolors the scene when the theme changes, without rebuilding it.
    effect(() => {
      this.theme.mode();
      if (this.scene) {
        this.applyThemeColors();
        this.renderStaticFrameIfPaused();
      }
    });

    // afterNextRender, not ngAfterViewInit: WebGL only exists in the browser
    // and this callback never runs while prerendering the landing page.
    afterNextRender(() => {
      if (!this.buildScene()) {
        this.webglUnavailable.set(true);
        return;
      }
      this.applyThemeColors();
      this.listen(destroyRef);
      this.syncPlayback();
    });

    destroyRef.onDestroy(() => this.dispose());
  }

  private listen(destroyRef: DestroyRef): void {
    this.reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    this.finePointer = window.matchMedia(FINE_POINTER_QUERY);

    const onVisibility = (): void => this.syncPlayback();
    const onPointerMove = (event: PointerEvent): void => this.trackPointer(event);
    document.addEventListener('visibilitychange', onVisibility);
    this.reducedMotion.addEventListener('change', onVisibility);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // ResizeObserver instead of window:resize: the canvas can change size
    // without a window resize (lazy styles, scrollbars), which used to leave a
    // stale camera aspect and stretched the nodes into ovals.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasRef().nativeElement);

    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.reducedMotion?.removeEventListener('change', onVisibility);
      window.removeEventListener('pointermove', onPointerMove);
      this.resizeObserver?.disconnect();
    });
  }

  // Runs the loop only when it is visible and motion is allowed; otherwise
  // leaves one static frame on screen.
  private syncPlayback(): void {
    const shouldAnimate = !document.hidden && !this.reducedMotion?.matches;
    if (shouldAnimate && this.animationFrameId === null) {
      this.lastFrameTime = null;
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else if (!shouldAnimate) {
      this.stop();
      this.renderStaticFrameIfPaused();
    }
  }

  private stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderStaticFrameIfPaused(): void {
    if (this.animationFrameId === null && this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Parallax only follows a real mouse; touch and pen-less screens drift.
  private trackPointer(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || !this.finePointer?.matches) {
      return;
    }
    this.pointerTargetX = (event.clientX / window.innerWidth - 0.5) * 2 * PARALLAX.strength;
    this.pointerTargetY = (event.clientY / window.innerHeight - 0.5) * 2 * PARALLAX.strength;
  }

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const { clientWidth, clientHeight } = canvas;
    if (!this.camera || !this.renderer || clientWidth === 0 || clientHeight === 0) {
      return;
    }
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.renderStaticFrameIfPaused();
  }

  private buildScene(): boolean {
    const canvas = this.canvasRef().nativeElement;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return false;
    }

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, SCENE.maxPixelRatio));
    this.renderer.setSize(width, height, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(SCENE.cameraFov, width / height, 0.1, 1000);
    this.camera.position.z = SCENE.cameraZ;
    this.scene.add(this.group);

    this.hub = new THREE.Mesh(this.hubGeometry, this.hubMaterial);
    this.group.add(this.hub);

    this.nodeMaterials.push(new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial());
    for (let i = 0; i < SCENE.nodeCount; i++) {
      this.group.add(this.createNode(this.nodeMaterials[i % this.nodeMaterials.length]));
    }

    this.group.add(new THREE.LineSegments(this.lineGeometry, this.lineMaterial));

    for (let i = 0; i < SCENE.ringCount; i++) {
      const innerRadius = SCENE.ringBaseRadius + i * SCENE.ringGap;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, innerRadius + SCENE.ringThickness, 64),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: SCENE.ringBaseOpacity - i * SCENE.ringOpacityStep,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = SCENE.ringTilt;
      this.group.add(ring);
      this.rings.push(ring);
    }

    this.updateConnections();
    return true;
  }

  private createNode(material: THREE.MeshBasicMaterial): THREE.Mesh {
    const node = new THREE.Mesh(this.nodeGeometry, material);
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = SCENE.shellRadiusMin + Math.random() * SCENE.shellRadiusSpan;
    const origin = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta) * SCENE.shellSquashY,
      radius * Math.cos(phi) * SCENE.shellSquashZ
    );
    node.position.copy(origin);
    const userData: NodeUserData = {
      origin,
      speed: MOTION.nodeDriftSpeedMin + Math.random() * MOTION.nodeDriftSpeedSpan,
      phase: Math.random() * Math.PI * 2,
    };
    node.userData = userData;
    this.nodes.push(node);
    return node;
  }

  // Reads the current color tokens and applies them to the existing
  // materials: no color is ever hardcoded in the scene.
  private applyThemeColors(): void {
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--color-accent').trim();
    const success = styles.getPropertyValue('--color-status-success').trim();
    const neutral = styles.getPropertyValue('--color-status-neutral').trim();

    this.hubMaterial.color.set(accent);
    this.nodeMaterials[0]?.color.set(accent);
    this.nodeMaterials[1]?.color.set(success);
    this.nodeMaterials[2]?.color.set(neutral);
    this.lineMaterial.color.set(accent);
    this.rings.forEach((ring) => (ring.material as THREE.MeshBasicMaterial).color.set(accent));
  }

  // Rebuilds the hub-node and nearby node-node links.
  private updateConnections(): void {
    const positions: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i].position;
      if (i % SCENE.hubLinkEvery === 0 && node.length() < SCENE.hubConnectDistance) {
        positions.push(0, 0, 0, node.x, node.y, node.z);
      }
      for (let j = i + 1; j < this.nodes.length; j++) {
        const other = this.nodes[j].position;
        if (node.distanceTo(other) < SCENE.connectDistance) {
          positions.push(node.x, node.y, node.z, other.x, other.y, other.z);
        }
      }
    }
    this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  }

  private animate = (now: number): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    const delta = this.lastFrameTime === null ? 0 : (now - this.lastFrameTime) / MS_PER_SECOND;
    this.lastFrameTime = now;
    this.elapsed += Math.min(delta, MOTION.maxFrameDelta);
    const time = this.elapsed;

    if (!this.finePointer?.matches) {
      this.pointerTargetX = Math.sin(time * PARALLAX.touchDriftRate * Math.PI * 2) * PARALLAX.touchDriftAmplitude;
      this.pointerTargetY = Math.cos(time * PARALLAX.touchDriftRate * Math.PI) * PARALLAX.touchDriftAmplitude;
    }
    this.pointerX += (this.pointerTargetX - this.pointerX) * PARALLAX.lerp;
    this.pointerY += (this.pointerTargetY - this.pointerY) * PARALLAX.lerp;

    this.group.rotation.y = time * MOTION.spinY + this.pointerX;
    this.group.rotation.x = Math.sin(time * MOTION.wobbleX * Math.PI * 2) * MOTION.wobbleXAmplitude + this.pointerY;

    if (this.hub) {
      this.hub.rotation.x = time * MOTION.hubSpinX;
      this.hub.rotation.y = time * MOTION.hubSpinY;
      this.hub.scale.setScalar(1 + Math.sin(time * MOTION.hubPulseRate * Math.PI * 2) * MOTION.hubPulseAmplitude);
    }

    for (const node of this.nodes) {
      const { origin, speed, phase } = node.userData as NodeUserData;
      node.position.y = origin.y + Math.sin(time * speed + phase) * MOTION.nodeDriftY;
      node.position.x = origin.x + Math.cos(time * speed * 0.75 + phase) * MOTION.nodeDriftX;
    }

    this.rings.forEach((ring, index) => {
      ring.rotation.z = -time * (MOTION.ringSpin + index * MOTION.ringSpinStep);
      const breath = (time * MOTION.ringBreathRate + index / SCENE.ringCount) % 1;
      ring.scale.setScalar(1 + breath * MOTION.ringBreathSpan * MOTION.ringBreathScale);
    });

    if (++this.frameCount % MOTION.connectionRefreshFrames === 0) {
      this.updateConnections();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private dispose(): void {
    this.stop();
    this.nodeGeometry.dispose();
    this.nodeMaterials.forEach((material) => material.dispose());
    this.hubGeometry.dispose();
    this.hubMaterial.dispose();
    this.lineGeometry.dispose();
    this.lineMaterial.dispose();
    this.rings.forEach((ring) => {
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    });
    this.renderer?.dispose();
  }
}
