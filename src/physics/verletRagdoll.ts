import * as THREE from 'three';
import { HitZone } from '../types';

export interface RagdollNode {
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  mass: number;
  radius: number;
  name: string;
  isGrounded: boolean;
}

export interface RagdollConstraint {
  p1: number;
  p2: number;
  distance: number;
  stiffness: number;
}

export interface HitboxDefinition {
  zone: HitZone;
  nodeIndex: number;
  secondaryNodeIndex?: number;
  mesh: THREE.Mesh;
  radius: number;
  height: number;
}

export interface ObstacleBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export class VerletRagdoll {
  public id: string;
  public nodes: RagdollNode[] = [];
  public constraints: RagdollConstraint[] = [];
  public hitboxes: HitboxDefinition[] = [];
  public group: THREE.Group;
  
  public state: 'alive' | 'stagger' | 'ragdoll' = 'alive';
  public health: number = 100;
  public maxHealth: number = 100;
  public basePosition: THREE.Vector3;
  public orientation: number = 0; // facing angle
  
  private aliveTime: number = 0;
  public staggerTime: number = 0;
  public staggerVector: THREE.Vector3 = new THREE.Vector3();
  
  public isDragged: boolean = false;
  public draggedNodeIndex: number = -1;
  public dragTarget: THREE.Vector3 = new THREE.Vector3();

  // Bot combat & attack AI
  public isAttacking: boolean = false;
  public attackTimer: number = 0;
  public lastPunchTime: number = 0;
  public isChasing: boolean = true;

  // Scratch vectors for zero-GC loop
  private static _v1 = new THREE.Vector3();
  private static _v2 = new THREE.Vector3();
  private static _diff = new THREE.Vector3();
  private static _normal = new THREE.Vector3();

  constructor(id: string, initialPos: THREE.Vector3, orientation: number = 0) {
    this.id = id;
    this.basePosition = initialPos.clone();
    this.orientation = orientation;
    this.group = new THREE.Group();

    this.initNodes();
    this.initConstraints();
    this.setPoseFromBase(0);
  }

  // Node indices mapping
  public static readonly HEAD = 0;
  public static readonly NECK = 1;
  public static readonly CHEST = 2;
  public static readonly STOMACH = 3;
  public static readonly PELVIS = 4;
  public static readonly L_SHOULDER = 5;
  public static readonly L_ELBOW = 6;
  public static readonly L_HAND = 7;
  public static readonly R_SHOULDER = 8;
  public static readonly R_ELBOW = 9;
  public static readonly R_HAND = 10;
  public static readonly L_HIP = 11;
  public static readonly L_KNEE = 12;
  public static readonly L_FOOT = 13;
  public static readonly R_HIP = 14;
  public static readonly R_KNEE = 15;
  public static readonly R_FOOT = 16;

  private initNodes() {
    // 17 interconnected anatomical skeleton nodes
    const nodeDefs: Array<{ name: string; mass: number; radius: number }> = [
      { name: 'head', mass: 4.5, radius: 0.14 },
      { name: 'neck', mass: 2.0, radius: 0.08 },
      { name: 'chest', mass: 18.0, radius: 0.18 },
      { name: 'stomach', mass: 12.0, radius: 0.16 },
      { name: 'pelvis', mass: 15.0, radius: 0.17 },
      { name: 'l_shoulder', mass: 3.5, radius: 0.09 },
      { name: 'l_elbow', mass: 2.5, radius: 0.08 },
      { name: 'l_hand', mass: 1.2, radius: 0.07 },
      { name: 'r_shoulder', mass: 3.5, radius: 0.09 },
      { name: 'r_elbow', mass: 2.5, radius: 0.08 },
      { name: 'r_hand', mass: 1.2, radius: 0.07 },
      { name: 'l_hip', mass: 6.0, radius: 0.11 },
      { name: 'l_knee', mass: 4.5, radius: 0.09 },
      { name: 'l_foot', mass: 2.0, radius: 0.09 },
      { name: 'r_hip', mass: 6.0, radius: 0.11 },
      { name: 'r_knee', mass: 4.5, radius: 0.09 },
      { name: 'r_foot', mass: 2.0, radius: 0.09 },
    ];

    this.nodes = nodeDefs.map((def) => ({
      pos: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
      mass: def.mass,
      radius: def.radius,
      name: def.name,
      isGrounded: false,
    }));
  }

  private addConstraint(p1: number, p2: number, stiffness = 1.0) {
    const d = this.nodes[p1].pos.distanceTo(this.nodes[p2].pos);
    this.constraints.push({
      p1,
      p2,
      distance: d > 0.001 ? d : 0.3,
      stiffness,
    });
  }

  private initConstraints() {
    this.constraints = [];
    // Set dummy initial offsets to compute natural rest lengths
    this.setPoseFromBase(0);

    // Spine chain
    this.addConstraint(VerletRagdoll.HEAD, VerletRagdoll.NECK, 1.0);
    this.addConstraint(VerletRagdoll.NECK, VerletRagdoll.CHEST, 1.0);
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.STOMACH, 1.0);
    this.addConstraint(VerletRagdoll.STOMACH, VerletRagdoll.PELVIS, 1.0);

    // Shoulder girdles & upper torso rigidity
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.L_SHOULDER, 1.0);
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.R_SHOULDER, 1.0);
    this.addConstraint(VerletRagdoll.L_SHOULDER, VerletRagdoll.R_SHOULDER, 1.0);
    this.addConstraint(VerletRagdoll.NECK, VerletRagdoll.L_SHOULDER, 0.9);
    this.addConstraint(VerletRagdoll.NECK, VerletRagdoll.R_SHOULDER, 0.9);

    // Left Arm
    this.addConstraint(VerletRagdoll.L_SHOULDER, VerletRagdoll.L_ELBOW, 1.0);
    this.addConstraint(VerletRagdoll.L_ELBOW, VerletRagdoll.L_HAND, 1.0);

    // Right Arm
    this.addConstraint(VerletRagdoll.R_SHOULDER, VerletRagdoll.R_ELBOW, 1.0);
    this.addConstraint(VerletRagdoll.R_ELBOW, VerletRagdoll.R_HAND, 1.0);

    // Pelvis & Hips
    this.addConstraint(VerletRagdoll.PELVIS, VerletRagdoll.L_HIP, 1.0);
    this.addConstraint(VerletRagdoll.PELVIS, VerletRagdoll.R_HIP, 1.0);
    this.addConstraint(VerletRagdoll.L_HIP, VerletRagdoll.R_HIP, 1.0);

    // Left Leg
    this.addConstraint(VerletRagdoll.L_HIP, VerletRagdoll.L_KNEE, 1.0);
    this.addConstraint(VerletRagdoll.L_KNEE, VerletRagdoll.L_FOOT, 1.0);

    // Right Leg
    this.addConstraint(VerletRagdoll.R_HIP, VerletRagdoll.R_KNEE, 1.0);
    this.addConstraint(VerletRagdoll.R_KNEE, VerletRagdoll.R_FOOT, 1.0);

    // Cross-bracing to prevent unnatural twisting/inversion
    this.addConstraint(VerletRagdoll.HEAD, VerletRagdoll.CHEST, 0.8);
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.PELVIS, 0.85);
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.L_HIP, 0.7);
    this.addConstraint(VerletRagdoll.CHEST, VerletRagdoll.R_HIP, 0.7);
    this.addConstraint(VerletRagdoll.PELVIS, VerletRagdoll.L_SHOULDER, 0.7);
    this.addConstraint(VerletRagdoll.PELVIS, VerletRagdoll.R_SHOULDER, 0.7);
    this.addConstraint(VerletRagdoll.L_HIP, VerletRagdoll.R_KNEE, 0.3);
    this.addConstraint(VerletRagdoll.R_HIP, VerletRagdoll.L_KNEE, 0.3);
  }

  // Set procedural standing/running/punching/stagger pose when alive
  public setPoseFromBase(
    time: number,
    isRunning: boolean = false,
    isPunching: boolean = false,
    punchPhase: number = 0
  ) {
    const bx = this.basePosition.x;
    const by = this.basePosition.y;
    const bz = this.basePosition.z;
    const cosO = Math.cos(this.orientation);
    const sinO = Math.sin(this.orientation);

    // Breathing and idle sway
    const breathe = Math.sin(time * 2.2) * 0.015;
    const swayX = Math.sin(time * 1.1) * 0.01;

    // Stagger offset if recovering
    let stagX = 0;
    let stagZ = 0;
    if (this.state === 'stagger') {
      stagX = this.staggerVector.x * (this.staggerTime * 0.6);
      stagZ = this.staggerVector.z * (this.staggerTime * 0.6);
    }

    // Torso forward lean when running
    const forwardLean = isRunning ? 0.10 : (isPunching ? 0.06 : 0);

    // Transform local humanoid coords (X: right, Y: up, Z: forward) to world
    const toWorld = (lx: number, ly: number, lz: number, target: THREE.Vector3) => {
      const totalZ = lz + forwardLean;
      const wx = bx + stagX + (lx * cosO - totalZ * sinO) + swayX;
      const wy = by + ly + breathe;
      const wz = bz + stagZ + (lx * sinO + totalZ * cosO);
      target.set(wx, wy, wz);
    };

    // Stance dimensions ~ 1.80m
    toWorld(0, 0.98, 0, this.nodes[VerletRagdoll.PELVIS].pos);
    toWorld(0, 1.20, 0.01, this.nodes[VerletRagdoll.STOMACH].pos);
    toWorld(0, 1.42, 0.02, this.nodes[VerletRagdoll.CHEST].pos);
    toWorld(0, 1.58, 0.03, this.nodes[VerletRagdoll.NECK].pos);
    toWorld(0, 1.74, 0.04, this.nodes[VerletRagdoll.HEAD].pos);

    // Shoulders
    toWorld(-0.24, 1.40, -0.01, this.nodes[VerletRagdoll.L_SHOULDER].pos);
    toWorld(0.24, 1.40, -0.01, this.nodes[VerletRagdoll.R_SHOULDER].pos);

    // Arms: Punching or Running or Idle
    if (isPunching) {
      // Melee Punch Strike (alternating or heavy right cross)
      const punchReach = Math.sin(punchPhase * Math.PI); // 0 -> 1 -> 0

      // Left arm in defensive boxing guard
      toWorld(-0.16, 1.32, 0.22, this.nodes[VerletRagdoll.L_ELBOW].pos);
      toWorld(-0.12, 1.46, 0.35, this.nodes[VerletRagdoll.L_HAND].pos);

      // Right arm throws forward punch!
      toWorld(0.20, 1.36, 0.12 + punchReach * 0.35, this.nodes[VerletRagdoll.R_ELBOW].pos);
      toWorld(0.10, 1.44, 0.26 + punchReach * 0.65, this.nodes[VerletRagdoll.R_HAND].pos);
    } else if (isRunning) {
      // Dynamic running arm pump
      const armSwing = Math.sin(time * 8.5) * 0.28;
      toWorld(-0.26, 1.14, -armSwing * 0.7, this.nodes[VerletRagdoll.L_ELBOW].pos);
      toWorld(-0.27, 1.02, 0.12 - armSwing, this.nodes[VerletRagdoll.L_HAND].pos);

      toWorld(0.26, 1.14, armSwing * 0.7, this.nodes[VerletRagdoll.R_ELBOW].pos);
      toWorld(0.27, 1.02, 0.12 + armSwing, this.nodes[VerletRagdoll.R_HAND].pos);
    } else {
      // Idle ready stance
      toWorld(-0.28, 1.10, 0.05, this.nodes[VerletRagdoll.L_ELBOW].pos);
      toWorld(-0.29, 0.82, 0.12, this.nodes[VerletRagdoll.L_HAND].pos);

      toWorld(0.28, 1.10, 0.05, this.nodes[VerletRagdoll.R_ELBOW].pos);
      toWorld(0.29, 0.82, 0.12, this.nodes[VerletRagdoll.R_HAND].pos);
    }

    // Hips
    toWorld(-0.16, 0.94, 0, this.nodes[VerletRagdoll.L_HIP].pos);
    toWorld(0.16, 0.94, 0, this.nodes[VerletRagdoll.R_HIP].pos);

    // Legs: Running stride or athletic stance
    let lLeg = 0;
    let rLeg = 0;
    if (isRunning) {
      lLeg = Math.sin(time * 8.5) * 0.38;
      rLeg = -lLeg;
    } else if (isPunching) {
      lLeg = -0.15;
      rLeg = 0.18;
    }

    toWorld(-0.16, 0.50, 0.02 + lLeg * 0.6, this.nodes[VerletRagdoll.L_KNEE].pos);
    toWorld(-0.16, 0.08, 0.00 + lLeg, this.nodes[VerletRagdoll.L_FOOT].pos);

    toWorld(0.16, 0.50, 0.02 + rLeg * 0.6, this.nodes[VerletRagdoll.R_KNEE].pos);
    toWorld(0.16, 0.08, 0.00 + rLeg, this.nodes[VerletRagdoll.R_FOOT].pos);

    // In alive mode, previous position tracks position exactly
    for (const node of this.nodes) {
      node.prevPos.copy(node.pos);
    }
  }

  // Update Bot Combat AI (Run towards player, punch when close)
  public updateBotCombat(
    dt: number,
    playerPos: THREE.Vector3,
    onPunchPlayer?: (damage: number) => void
  ) {
    if (this.state !== 'alive') return;

    this.aliveTime += dt;

    // Vector to player in XZ plane
    const dx = playerPos.x - this.basePosition.x;
    const dz = playerPos.z - this.basePosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Turn orientation towards player
    const targetAngle = Math.atan2(dx, dz);
    this.orientation = THREE.MathUtils.damp(this.orientation, targetAngle, 8.5, dt);

    if (dist > 1.35) {
      // Run toward player
      this.isAttacking = false;
      const runSpeed = 3.3;
      this.basePosition.x += Math.sin(this.orientation) * runSpeed * dt;
      this.basePosition.z += Math.cos(this.orientation) * runSpeed * dt;

      this.setPoseFromBase(this.aliveTime, true, false, 0);
    } else {
      // Within melee range: punch player!
      this.isAttacking = true;
      this.attackTimer += dt * 3.2;
      const punchPhase = this.attackTimer % 1.0;

      this.setPoseFromBase(this.aliveTime, false, true, punchPhase);

      // Hit connects at peak punch extension (phase ~ 0.5)
      if (punchPhase >= 0.45 && punchPhase <= 0.6) {
        const now = performance.now();
        if (now - this.lastPunchTime > 700) {
          this.lastPunchTime = now;
          if (onPunchPlayer) {
            onPunchPlayer(15);
          }
        }
      }
    }
  }

  // Trigger hit reaction or lethal ragdoll
  public applyHit(
    zone: HitZone,
    hitPoint: THREE.Vector3,
    bulletVector: THREE.Vector3,
    bulletForce: number,
    damage: number
  ): { isFatal: boolean; zone: HitZone } {
    this.health -= damage;
    const isFatal = this.health <= 0;

    // Determine target primary node for impulse transfer
    let targetNodeIdx = VerletRagdoll.CHEST;
    let forceMultiplier = 1.0;

    switch (zone) {
      case 'head':
        targetNodeIdx = VerletRagdoll.HEAD;
        forceMultiplier = 2.4;
        break;
      case 'neck':
        targetNodeIdx = VerletRagdoll.NECK;
        forceMultiplier = 1.8;
        break;
      case 'chest':
        targetNodeIdx = VerletRagdoll.CHEST;
        forceMultiplier = 1.5;
        break;
      case 'spine':
        targetNodeIdx = VerletRagdoll.STOMACH;
        forceMultiplier = 1.3;
        break;
      case 'pelvis':
        targetNodeIdx = VerletRagdoll.PELVIS;
        forceMultiplier = 1.4;
        break;
      case 'left_arm':
        targetNodeIdx = VerletRagdoll.L_SHOULDER;
        forceMultiplier = 1.2;
        break;
      case 'right_arm':
        targetNodeIdx = VerletRagdoll.R_SHOULDER;
        forceMultiplier = 1.2;
        break;
      case 'left_leg':
        targetNodeIdx = VerletRagdoll.L_KNEE;
        forceMultiplier = 1.3;
        break;
      case 'right_leg':
        targetNodeIdx = VerletRagdoll.R_KNEE;
        forceMultiplier = 1.3;
        break;
    }

    const impulse = bulletVector.clone().normalize().multiplyScalar(bulletForce * forceMultiplier);

    if (isFatal || zone === 'head') {
      // Transition to full ragdoll
      this.state = 'ragdoll';
      this.health = 0;

      // Transfer impulse to hit node
      const node = this.nodes[targetNodeIdx];
      node.prevPos.copy(node.pos).sub(impulse.clone().multiplyScalar(0.04));

      // Disperse partial momentum to connected nodes for realistic whole-body whip/jolt
      const neighbors = this.getNeighborNodeIndices(targetNodeIdx);
      for (const nIdx of neighbors) {
        const nNode = this.nodes[nIdx];
        nNode.prevPos.copy(nNode.pos).sub(impulse.clone().multiplyScalar(0.02));
      }

      // Add a slight upward twist so body doesn't just sink like lead
      impulse.y += bulletForce * 0.15;
    } else {
      // Non-fatal stagger: recoil along bullet vector
      this.state = 'stagger';
      this.staggerTime = 0.5;
      this.staggerVector.copy(impulse).multiplyScalar(0.015);
      // Small velocity perturbation
      this.nodes[targetNodeIdx].prevPos.copy(this.nodes[targetNodeIdx].pos).sub(impulse.clone().multiplyScalar(0.01));
    }

    return { isFatal: this.state === 'ragdoll', zone };
  }

  private getNeighborNodeIndices(nodeIdx: number): number[] {
    const list: number[] = [];
    for (const c of this.constraints) {
      if (c.p1 === nodeIdx) list.push(c.p2);
      else if (c.p2 === nodeIdx) list.push(c.p1);
    }
    return list;
  }

  // Apply continuous physics step (Verlet integration)
  public updatePhysics(
    dt: number,
    gravityY: number,
    obstacles: ObstacleBox[] = [],
    onFloorThud?: (intensity: number) => void
  ) {
    if (this.state === 'alive') {
      this.aliveTime += dt;
      this.setPoseFromBase(this.aliveTime, false);
      return;
    }

    if (this.state === 'stagger') {
      this.staggerTime -= dt;
      if (this.staggerTime <= 0) {
        this.state = 'alive';
      } else {
        this.aliveTime += dt;
        this.setPoseFromBase(this.aliveTime, false);
      }
      return;
    }

    // State is 'ragdoll': run Verlet simulation
    const subSteps = 6;
    const subDt = dt / subSteps;
    const subDtSq = subDt * subDt;
    const airDamping = 0.985;
    const groundFriction = 0.72;

    const gAcc = new THREE.Vector3(0, gravityY, 0);

    for (let step = 0; step < subSteps; step++) {
      // 1. Move nodes
      for (let i = 0; i < this.nodes.length; i++) {
        const node = this.nodes[i];

        // If being dragged by mouse, anchor dragged node to target while preserving velocity
        if (this.isDragged && i === this.draggedNodeIndex) {
          if (step === 0) {
            // Track previous position before jumping to new drag target to preserve throwing momentum
            node.prevPos.copy(node.pos);
          }
          node.pos.copy(this.dragTarget);
          continue;
        }

        // Verlet velocity = (pos - prevPos) * damping
        const vx = (node.pos.x - node.prevPos.x) * (node.isGrounded ? groundFriction : airDamping);
        const vy = (node.pos.y - node.prevPos.y) * airDamping;
        const vz = (node.pos.z - node.prevPos.z) * (node.isGrounded ? groundFriction : airDamping);

        node.prevPos.copy(node.pos);

        node.pos.x += vx + gAcc.x * subDtSq;
        node.pos.y += vy + gAcc.y * subDtSq;
        node.pos.z += vz + gAcc.z * subDtSq;

        // Ground collision (y = node.radius)
        if (node.pos.y < node.radius) {
          const impactSpeed = Math.abs(vy);
          if (impactSpeed > 0.08 && onFloorThud && !node.isGrounded) {
            onFloorThud(Math.min(1.5, impactSpeed * 8));
          }
          node.pos.y = node.radius;
          node.isGrounded = true;
          // Apply horizontal ground friction
          node.prevPos.x = node.pos.x - vx * 0.35;
          node.prevPos.z = node.pos.z - vz * 0.35;
        } else {
          node.isGrounded = false;
        }

        // Environment obstacle collisions (e.g. training crates/boxes)
        for (const obs of obstacles) {
          if (
            node.pos.x > obs.min.x - node.radius &&
            node.pos.x < obs.max.x + node.radius &&
            node.pos.z > obs.min.z - node.radius &&
            node.pos.z < obs.max.z + node.radius &&
            node.pos.y > obs.min.y - node.radius &&
            node.pos.y < obs.max.y + node.radius
          ) {
            // Push out along smallest penetration axis
            const dLeft = Math.abs(node.pos.x - (obs.min.x - node.radius));
            const dRight = Math.abs(obs.max.x + node.radius - node.pos.x);
            const dBottom = Math.abs(node.pos.y - (obs.min.y - node.radius));
            const dTop = Math.abs(obs.max.y + node.radius - node.pos.y);
            const dFront = Math.abs(node.pos.z - (obs.min.z - node.radius));
            const dBack = Math.abs(obs.max.z + node.radius - node.pos.z);

            const minD = Math.min(dLeft, dRight, dTop, dBottom, dFront, dBack);

            if (minD === dTop) {
              node.pos.y = obs.max.y + node.radius;
              node.isGrounded = true;
            } else if (minD === dLeft) {
              node.pos.x = obs.min.x - node.radius;
            } else if (minD === dRight) {
              node.pos.x = obs.max.x + node.radius;
            } else if (minD === dFront) {
              node.pos.z = obs.min.z - node.radius;
            } else if (minD === dBack) {
              node.pos.z = obs.max.z + node.radius;
            } else {
              node.pos.y = obs.min.y - node.radius;
            }
          }
        }
      }

      // 2. Satisfy distance constraints
      for (const c of this.constraints) {
        const n1 = this.nodes[c.p1];
        const n2 = this.nodes[c.p2];

        VerletRagdoll._diff.subVectors(n2.pos, n1.pos);
        const currentDist = VerletRagdoll._diff.length();
        if (currentDist < 0.0001) continue;

        const delta = (currentDist - c.distance) / currentDist;
        const totalMass = n1.mass + n2.mass;
        const m1Ratio = n2.mass / totalMass;
        const m2Ratio = n1.mass / totalMass;

        // Correct positions based on relative mass
        const correction = VerletRagdoll._diff.multiplyScalar(delta * c.stiffness * 0.5);

        if (!this.isDragged || c.p1 !== this.draggedNodeIndex) {
          n1.pos.addScaledVector(correction, m1Ratio);
        }
        if (!this.isDragged || c.p2 !== this.draggedNodeIndex) {
          n2.pos.addScaledVector(correction, -m2Ratio);
        }
      }

      // 3. Anatomical joint limits (e.g. knees don't bend backward)
      this.enforceJointLimits();
    }
  }

  private enforceJointLimits() {
    // Prevent knee reverse hyperextension
    this.enforceKneeLimit(VerletRagdoll.L_HIP, VerletRagdoll.L_KNEE, VerletRagdoll.L_FOOT);
    this.enforceKneeLimit(VerletRagdoll.R_HIP, VerletRagdoll.R_KNEE, VerletRagdoll.R_FOOT);
  }

  private enforceKneeLimit(hipIdx: number, kneeIdx: number, footIdx: number) {
    const hip = this.nodes[hipIdx].pos;
    const knee = this.nodes[kneeIdx].pos;
    const foot = this.nodes[footIdx].pos;

    // Vector from hip to foot
    VerletRagdoll._v1.subVectors(foot, hip);
    const lineLen = VerletRagdoll._v1.length();
    if (lineLen < 0.001) return;
    VerletRagdoll._v1.normalize();

    // Projected point on hip-foot line
    VerletRagdoll._v2.subVectors(knee, hip);
    const proj = VerletRagdoll._v2.dot(VerletRagdoll._v1);
    const midPoint = VerletRagdoll._diff.copy(hip).addScaledVector(VerletRagdoll._v1, proj);

    // Vector perpendicular to leg axis
    const bendVec = VerletRagdoll._normal.subVectors(knee, midPoint);
    // If knee is pushed backward behind the leg plane, clamp or softly bias it forward
    if (bendVec.y < -0.05) {
      this.nodes[kneeIdx].pos.y += 0.01;
    }
  }

  // Reset to alive standing pose
  public reset(pos?: THREE.Vector3) {
    if (pos) {
      this.basePosition.copy(pos);
    }
    this.health = this.maxHealth;
    this.state = 'alive';
    this.aliveTime = 0;
    this.staggerTime = 0;
    this.isDragged = false;
    this.draggedNodeIndex = -1;
    this.setPoseFromBase(0);
  }

  // Find nearest node to a world 3D point (for mouse drag or hit detection)
  public getClosestNode(point: THREE.Vector3): { index: number; distance: number } {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = this.nodes[i].pos.distanceTo(point);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { index: bestIdx, distance: bestDist };
  }
}
