import * as THREE from 'three';

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

interface Casing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

export class ParticleSystem {
  public group: THREE.Group;
  
  private particles: Particle[] = [];
  private pointCloud: THREE.Points;
  private geo: THREE.BufferGeometry;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;

  private casings: Casing[] = [];
  private casingMat: THREE.MeshStandardMaterial;
  private casingGeo: THREE.CylinderGeometry;

  private tracers: Tracer[] = [];

  private readonly maxParticles = 600;

  constructor() {
    this.group = new THREE.Group();

    // 1. Instanced Points for sparks and impact blood/debris
    this.geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);

    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colAttr = new THREE.BufferAttribute(colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);

    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
    this.geo.setAttribute('size', this.sizeAttr);

    // Procedural particle sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const pTex = new THREE.CanvasTexture(canvas);

    const pMat = new THREE.PointsMaterial({
      size: 0.12,
      map: pTex,
      transparent: true,
      vertexColors: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    this.pointCloud = new THREE.Points(this.geo, pMat);
    this.group.add(this.pointCloud);

    // 2. Brass Bullet Casings
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b, // polished brass
      metalness: 0.9,
      roughness: 0.2,
    });
    this.casingGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.024, 8);
  }

  // Spawn impact burst at hit point
  public emitHit(point: THREE.Vector3, normal: THREE.Vector3, isHeadshot: boolean) {
    const count = isHeadshot ? 45 : 25;
    const baseColor = isHeadshot ? new THREE.Color(0xcc1122) : new THREE.Color(0xaa2233);
    const sparkColor = new THREE.Color(0xffcc44);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const isSpark = Math.random() < 0.35;
      const col = isSpark ? sparkColor : baseColor;

      // Cone around reflection normal
      const spread = 0.8;
      const vx = (normal.x + (Math.random() - 0.5) * spread) * (1.5 + Math.random() * 4.0);
      const vy = (normal.y + (Math.random() - 0.5) * spread) * (1.5 + Math.random() * 4.0);
      const vz = (normal.z + (Math.random() - 0.5) * spread) * (1.5 + Math.random() * 4.0);

      this.particles.push({
        pos: point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05)),
        vel: new THREE.Vector3(vx, vy, vz),
        color: col.clone(),
        size: isSpark ? 0.08 : 0.15,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
      });
    }
  }

  // Eject brass casing from gun
  public emitCasing(origin: THREE.Vector3, rightDir: THREE.Vector3) {
    if (this.casings.length > 25) {
      const old = this.casings.shift();
      if (old) this.group.remove(old.mesh);
    }

    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.group.add(mesh);

    // Eject up and right
    const vel = rightDir.clone().multiplyScalar(1.8 + Math.random() * 0.5);
    vel.y += 1.4 + Math.random() * 0.6;
    vel.z += (Math.random() - 0.5) * 0.4;

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35
    );

    this.casings.push({ mesh, vel, rotVel, life: 3.0 });
  }

  // Add high-speed glowing tracer line
  public emitTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const mat = new THREE.LineBasicMaterial({
      color: 0xffd277,
      transparent: true,
      opacity: 0.9,
    });
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  // Update particles and casings every frame
  public update(delta: number) {
    // 1. Update point particles
    const positions = this.posAttr.array as Float32Array;
    const colors = this.colAttr.array as Float32Array;
    const sizes = this.sizeAttr.array as Float32Array;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity and air drag
      p.vel.y -= 9.8 * delta;
      p.vel.multiplyScalar(0.96);

      p.pos.addScaledVector(p.vel, delta);

      // Floor bounce / stick
      if (p.pos.y < 0.02) {
        p.pos.y = 0.02;
        p.vel.set(0, 0, 0);
      }
    }

    // Write particle buffer
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        positions[i * 3] = p.pos.x;
        positions[i * 3 + 1] = p.pos.y;
        positions[i * 3 + 2] = p.pos.z;

        const fade = Math.max(0, p.life / p.maxLife);
        colors[i * 3] = p.color.r * fade;
        colors[i * 3 + 1] = p.color.g * fade;
        colors[i * 3 + 2] = p.color.b * fade;

        sizes[i] = p.size * fade;
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -999;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;

    // 2. Update casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= delta;

      if (c.life <= 0) {
        this.group.remove(c.mesh);
        this.casings.splice(i, 1);
        continue;
      }

      c.vel.y -= 9.8 * delta;
      c.mesh.position.addScaledVector(c.vel, delta);
      c.mesh.rotation.x += c.rotVel.x * delta;
      c.mesh.rotation.y += c.rotVel.y * delta;
      c.mesh.rotation.z += c.rotVel.z * delta;

      // Ground bounce
      if (c.mesh.position.y < 0.015) {
        c.mesh.position.y = 0.015;
        c.vel.y = -c.vel.y * 0.45;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
        c.rotVel.multiplyScalar(0.5);
      }
    }

    // 3. Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= delta;
      if (tr.life <= 0) {
        this.group.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  public clear() {
    this.particles = [];
    for (const c of this.casings) {
      this.group.remove(c.mesh);
    }
    this.casings = [];
    for (const tr of this.tracers) {
      this.group.remove(tr.line);
      tr.line.geometry.dispose();
      (tr.line.material as THREE.Material).dispose();
    }
    this.tracers = [];
  }
}
