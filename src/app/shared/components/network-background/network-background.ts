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
  hero: { nodeCount: 76, cameraZ: 72, connectDistance: 28, hubConnectDistance: 42 },
  ambient: { nodeCount: 30, cameraZ: 110, connectDistance: 20, hubConnectDistance: 34 },
} as const;

interface NodeUserData {
  origin: THREE.Vector3;
  speed: number;
  phase: number;
}

// Fondo decorativo con una nube de nodos conectados tipo topología de red,
// distribuidos en un cascarón esférico (más densos hacia los bordes de la
// vista, centro despejado para no competir con la tarjeta de autenticación).
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
  private readonly nodeGeometry = new THREE.SphereGeometry(1.1, 12, 12);
  private readonly nodeMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly hubGeometry = new THREE.OctahedronGeometry(5.1, 1);
  private readonly hubMaterial = new THREE.MeshBasicMaterial({ wireframe: true });
  private hub?: THREE.Mesh;
  private readonly lineMaterial = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.26 });
  private readonly lineGeometry = new THREE.BufferGeometry();
  private lines?: THREE.LineSegments;
  private readonly rings: THREE.Mesh[] = [];

  private animationFrameId: number | null = null;
  private pointerTargetX = 0;
  private pointerTargetY = 0;
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
    this.pointerTargetX = (event.clientX - window.innerWidth / 2) * 0.00045;
    this.pointerTargetY = (event.clientY - window.innerHeight / 2) * 0.00045;
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

    // Distribución en cascarón esférico: nodos concentrados hacia los bordes
    // de la vista, con el centro despejado para no competir con la tarjeta.
    for (let i = 0; i < preset.nodeCount; i++) {
      const material = this.nodeMaterials[i % this.nodeMaterials.length];
      const node = new THREE.Mesh(this.nodeGeometry, material);

      const u = Math.random();
      const v = Math.random();
      const theta = u * 2 * Math.PI;
      const phi = Math.acos(2 * v - 1);
      const r = 26 + Math.random() * 38;

      const origin = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.65,
        r * Math.cos(phi) * 0.8
      );
      node.position.copy(origin);

      const userData: NodeUserData = {
        origin,
        speed: 0.25 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
      };
      node.userData = userData;
      this.nodes.push(node);
      this.group.add(node);
    }

    this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    this.group.add(this.lines);

    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.RingGeometry(11 + i * 13, 11.5 + i * 13, 64);
      const ringMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.28 - i * 0.07,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2.3;
      this.group.add(ring);
      this.rings.push(ring);
    }

    this.updateConnections();
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

  // Recalcula las líneas de conexión (hub-nodo y nodo-nodo cercano). Es
  // costoso en O(n²), por lo que animate() lo llama cada pocos frames.
  private updateConnections(): void {
    const preset = INTENSITY_PRESETS[this.intensity()];
    const positions: number[] = [];

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (i % 3 === 0 && node.position.length() < preset.hubConnectDistance) {
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
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.elapsed += 0.016;
    const time = this.elapsed;

    this.pointerX += (this.pointerTargetX - this.pointerX) * 0.05;
    this.pointerY += (this.pointerTargetY - this.pointerY) * 0.05;

    this.group.rotation.y = time * 0.07 + this.pointerX;
    this.group.rotation.x = Math.sin(time * 0.04) * 0.12 + this.pointerY;

    if (this.hub) {
      this.hub.rotation.x = time * 0.35;
      this.hub.rotation.y = time * 0.55;
      const pulse = 1 + Math.sin(time * 2.2) * 0.08;
      this.hub.scale.setScalar(pulse);
    }

    this.nodes.forEach((node) => {
      const { origin, speed, phase } = node.userData as NodeUserData;
      node.position.y = origin.y + Math.sin(time * speed + phase) * 2.2;
      node.position.x = origin.x + Math.cos(time * (speed * 0.75) + phase) * 1.4;
    });

    this.rings.forEach((ring, index) => {
      ring.rotation.z = -time * (0.08 + index * 0.04);
      const scale = 1 + ((time * 0.35 + index * 0.25) % 1.5) * 0.28;
      ring.scale.setScalar(scale);
    });

    if (Math.floor(time * 60) % 6 === 0) {
      this.updateConnections();
    }

    this.renderer.render(this.scene, this.camera);
  };
}
