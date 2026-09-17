import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { ThemeService } from '../../../core/theme/theme.service';

// Perfiles de densidad: "hero" para pantallas de auth (protagonista, a
// pantalla completa) y "ambient" para el shell de usuario/admin (de fondo,
// discreto, sin competir con tablas y formularios).
const INTENSITY_PRESETS = {
  hero: { nodeCount: 56, cameraZ: 42, connectDistance: 9, hubConnectDistance: 17 },
  ambient: { nodeCount: 24, cameraZ: 60, connectDistance: 10, hubConnectDistance: 18 },
} as const;

const SPREAD_X = 34;
const SPREAD_Y = 20;
const SPREAD_Z = 14;

interface NodeUserData {
  velocity: THREE.Vector3;
}

// Fondo decorativo con una nube de nodos conectados tipo topología de red.
// Vive en un layout compartido (AuthLayout / AppShellLayout), no en cada
// pantalla, para no reiniciar la escena al navegar entre rutas del mismo módulo.
@Component({
  selector: 'app-network-background',
  imports: [],
  templateUrl: './network-background.html',
  styleUrl: './network-background.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetworkBackground implements AfterViewInit, OnDestroy {
  readonly intensity = input<keyof typeof INTENSITY_PRESETS>('hero');

  private readonly theme = inject(ThemeService);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private readonly group = new THREE.Group();
  private readonly nodes: THREE.Mesh[] = [];
  private readonly nodeGeometry = new THREE.SphereGeometry(0.45, 12, 12);
  private readonly nodeMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly hubGeometry = new THREE.OctahedronGeometry(3, 1);
  private readonly hubMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  private hub?: THREE.Mesh;
  private readonly lineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.25 });
  private readonly lineGeometry = new THREE.BufferGeometry();
  private lines?: THREE.LineSegments;
  private readonly rings: THREE.Mesh[] = [];

  private animationFrameId: number | null = null;
  private pointerX = 0;
  private pointerY = 0;
  private ready = false;
  private elapsed = 0;

  constructor() {
    // Recolorea la escena cuando cambia el tema, sin reconstruirla.
    effect(() => {
      this.theme.mode();
      if (this.ready) {
        this.applyThemeColors();
      }
    });
  }

  ngAfterViewInit(): void {
    this.buildScene();
    this.ready = true;
    this.applyThemeColors();
    this.animate();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

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

  @HostListener('window:resize')
  onResize(): void {
    const canvas = this.canvasRef().nativeElement;
    const { clientWidth, clientHeight } = canvas;
    if (!this.camera || !this.renderer || clientWidth === 0 || clientHeight === 0) {
      return;
    }
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    this.pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
    this.pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  private buildScene(): void {
    const preset = INTENSITY_PRESETS[this.intensity()];
    const canvas = this.canvasRef().nativeElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.z = preset.cameraZ;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);

    this.scene.add(this.group);

    this.hub = new THREE.Mesh(this.hubGeometry, this.hubMaterial);
    this.group.add(this.hub);

    this.nodeMaterials.push(
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial()
    );

    for (let i = 0; i < preset.nodeCount; i++) {
      const material = this.nodeMaterials[i % this.nodeMaterials.length];
      const node = new THREE.Mesh(this.nodeGeometry, material);
      node.position.set(
        (Math.random() - 0.5) * SPREAD_X,
        (Math.random() - 0.5) * SPREAD_Y,
        (Math.random() - 0.5) * SPREAD_Z
      );
      const userData: NodeUserData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.01
        ),
      };
      node.userData = userData;
      this.nodes.push(node);
      this.group.add(node);
    }

    this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    this.group.add(this.lines);

    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.RingGeometry(9 + i * 8, 9.25 + i * 8, 48);
      const ringMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.16 - i * 0.05,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2.4;
      this.group.add(ring);
      this.rings.push(ring);
    }
  }

  // Lee los tokens de color actuales (--color-accent, etc.) y los aplica a
  // los materiales existentes: nunca se quema un color en la escena.
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

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    const preset = INTENSITY_PRESETS[this.intensity()];
    this.elapsed += 0.016;

    this.group.rotation.y += 0.0009 + this.pointerX * 0.0006;
    this.group.rotation.x += 0.0004 + this.pointerY * 0.0004;

    if (this.hub) {
      this.hub.rotation.x += 0.004;
      this.hub.rotation.y += 0.006;
      const pulse = 1 + Math.sin(this.elapsed * 1.4) * 0.06;
      this.hub.scale.setScalar(pulse);
    }

    const positions: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const { velocity } = node.userData as NodeUserData;
      node.position.add(velocity);
      if (Math.abs(node.position.x) > SPREAD_X / 2) velocity.x *= -1;
      if (Math.abs(node.position.y) > SPREAD_Y / 2) velocity.y *= -1;
      if (Math.abs(node.position.z) > SPREAD_Z / 2) velocity.z *= -1;

      if (node.position.length() < preset.hubConnectDistance) {
        positions.push(0, 0, 0, node.position.x, node.position.y, node.position.z);
      }

      for (let j = i + 1; j < this.nodes.length; j++) {
        const other = this.nodes[j];
        if (node.position.distanceTo(other.position) < preset.connectDistance) {
          positions.push(
            node.position.x,
            node.position.y,
            node.position.z,
            other.position.x,
            other.position.y,
            other.position.z
          );
        }
      }
    }
    this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    this.rings.forEach((ring, index) => {
      const scale = ring.scale.x + 0.0025 * (index + 1);
      ring.scale.setScalar(scale > 1.8 ? 0.6 : scale);
    });

    this.renderer.render(this.scene, this.camera);
  };
}
