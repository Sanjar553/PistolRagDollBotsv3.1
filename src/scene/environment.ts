import * as THREE from 'three';
import { ObstacleBox } from '../physics/verletRagdoll';

export class ShootingRangeEnvironment {
  public group: THREE.Group;
  public obstacles: ObstacleBox[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.buildFloor();
    this.buildPerimeter();
  }

  private buildFloor() {
    // 1. Procedural Grid / Open Combat Arena Floor Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Concrete dark base
    ctx.fillStyle = '#181c24';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle noise speckling
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const gray = Math.floor(22 + Math.random() * 22);
      ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // High-tech training grid lines
    ctx.strokeStyle = '#273142';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 512, 512);

    // Secondary sub-grid
    ctx.strokeStyle = '#1e2533';
    ctx.lineWidth = 1;
    for (let c = 64; c < 512; c += 64) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, c);
      ctx.lineTo(512, c);
      ctx.stroke();
    }

    const floorTexture = new THREE.CanvasTexture(canvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(32, 32);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    // Open Floor Mesh - wide 100x100m arena
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.group.add(floorMesh);

    // Tactical Range Line Decals
    this.createRangeMarker(5, '05 M');
    this.createRangeMarker(10, '10 M');
    this.createRangeMarker(15, '15 M');
    this.createRangeMarker(20, '20 M');
    this.createRangeMarker(25, '25 M');
  }

  private createRangeMarker(distanceZ: number, label: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Yellow tactical hazard stripes
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 256, 10);
    ctx.fillRect(0, 54, 256, 10);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 10, 256, 44);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`— RANGE ${label} —`, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const planeGeo = new THREE.PlaneGeometry(12, 1.2);
    const planeMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const marker = new THREE.Mesh(planeGeo, planeMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0.025, -distanceZ);
    this.group.add(marker);
  }

  private buildPerimeter() {
    // Distant perimeter acoustic pillars around the outer edge (far out at X=±24, Z=-32)
    // No obstacles in the playable fighting area
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
    });

    for (const x of [-24, 24]) {
      for (const z of [-2, -10, -18, -26, -34]) {
        const pillarGeo = new THREE.BoxGeometry(1.2, 8.0, 1.2);
        const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
        pillarMesh.position.set(x, 4.0, z);
        pillarMesh.castShadow = true;
        this.group.add(pillarMesh);
      }
    }
  }
}
