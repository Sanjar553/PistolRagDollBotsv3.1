import * as THREE from 'three';
import { VerletRagdoll } from '../physics/verletRagdoll';
import { HitZone } from '../types';

export interface HumanoidPartMesh {
  mesh: THREE.Object3D;
  startNode: number;
  endNode?: number;
  offsetY?: number;
  type: 'bone' | 'joint' | 'head';
}

export class HumanoidMesh {
  public rootGroup: THREE.Group;
  public ragdoll: VerletRagdoll;
  public hitboxMeshes: THREE.Mesh[] = [];
  
  private partMeshes: HumanoidPartMesh[] = [];
  private materials: {
    armor: THREE.MeshStandardMaterial;
    suit: THREE.MeshStandardMaterial;
    joint: THREE.MeshStandardMaterial;
    visor: THREE.MeshPhysicalMaterial;
    boots: THREE.MeshStandardMaterial;
    hitbox: THREE.MeshBasicMaterial;
    flashMaterial: THREE.MeshBasicMaterial;
  };

  private flashTimers: Map<THREE.Mesh, number> = new Map();

  // Scratch objects for zero-GC orientation
  private static _up = new THREE.Vector3(0, 1, 0);
  private static _dir = new THREE.Vector3();
  private static _quat = new THREE.Quaternion();
  private static _mid = new THREE.Vector3();

  constructor(ragdoll: VerletRagdoll) {
    this.ragdoll = ragdoll;
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = `humanoid_${ragdoll.id}`;

    this.materials = this.createMaterials();
    this.buildBody();
    this.buildHitboxes();
  }

  private createMaterials() {
    // High-spec PBR materials with varied roughness/metalness
    const armor = new THREE.MeshStandardMaterial({
      color: 0x242b35, // tactical slate gray
      roughness: 0.35,
      metalness: 0.65,
    });

    const suit = new THREE.MeshStandardMaterial({
      color: 0x181c22, // dark tactical weave
      roughness: 0.8,
      metalness: 0.1,
    });

    const joint = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.6,
      metalness: 0.2,
    });

    const visor = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      emissive: 0x004455,
      emissiveIntensity: 0.5,
      roughness: 0.1,
      metalness: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    const boots = new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.7,
      metalness: 0.3,
    });

    const hitbox = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      wireframe: true,
      visible: false, // toggleable via debug setting
    });

    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
    });

    return { armor, suit, joint, visor, boots, hitbox, flashMaterial };
  }

  private buildBody() {
    // 1. Head Group (Helmet + Visor + Chin guard)
    const headGroup = new THREE.Group();
    
    // Helmet dome
    const helmetGeo = new THREE.SphereGeometry(0.14, 16, 14);
    const helmetMesh = new THREE.Mesh(helmetGeo, this.materials.armor);
    helmetMesh.castShadow = true;
    headGroup.add(helmetMesh);

    // Visor strip
    const visorGeo = new THREE.BoxGeometry(0.18, 0.06, 0.12);
    const visorMesh = new THREE.Mesh(visorGeo, this.materials.visor);
    visorMesh.position.set(0, 0.01, 0.08);
    headGroup.add(visorMesh);

    // Chin guard
    const chinGeo = new THREE.BoxGeometry(0.12, 0.07, 0.12);
    const chinMesh = new THREE.Mesh(chinGeo, this.materials.armor);
    chinMesh.position.set(0, -0.09, 0.04);
    headGroup.add(chinMesh);

    this.rootGroup.add(headGroup);
    this.partMeshes.push({
      mesh: headGroup,
      startNode: VerletRagdoll.HEAD,
      type: 'head',
    });

    // 2. Neck
    const neckMesh = this.createSegmentMesh(0.07, 0.07, this.materials.joint);
    this.rootGroup.add(neckMesh);
    this.partMeshes.push({
      mesh: neckMesh,
      startNode: VerletRagdoll.NECK,
      endNode: VerletRagdoll.HEAD,
      type: 'bone',
    });

    // 3. Chest (Tactical Armored Vest)
    const chestGroup = new THREE.Group();
    const chestVestGeo = new THREE.BoxGeometry(0.38, 0.26, 0.24);
    const chestVestMesh = new THREE.Mesh(chestVestGeo, this.materials.armor);
    chestVestMesh.castShadow = true;
    chestGroup.add(chestVestMesh);

    // Chest plates / pouches
    const pouchGeo = new THREE.BoxGeometry(0.11, 0.09, 0.06);
    for (const offset of [-0.09, 0.09]) {
      const pouch = new THREE.Mesh(pouchGeo, this.materials.suit);
      pouch.position.set(offset, -0.04, 0.13);
      chestGroup.add(pouch);
    }

    this.rootGroup.add(chestGroup);
    this.partMeshes.push({
      mesh: chestGroup,
      startNode: VerletRagdoll.CHEST,
      endNode: VerletRagdoll.NECK,
      type: 'bone',
    });

    // 4. Stomach / Abdomen
    const stomachMesh = this.createSegmentBox(0.32, 0.22, 0.20, this.materials.suit);
    this.rootGroup.add(stomachMesh);
    this.partMeshes.push({
      mesh: stomachMesh,
      startNode: VerletRagdoll.STOMACH,
      endNode: VerletRagdoll.CHEST,
      type: 'bone',
    });

    // 5. Pelvis & Utility Belt
    const pelvisGroup = new THREE.Group();
    const pelvisGeo = new THREE.BoxGeometry(0.34, 0.18, 0.22);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, this.materials.armor);
    pelvisMesh.castShadow = true;
    pelvisGroup.add(pelvisMesh);

    // Belt buckle
    const buckleGeo = new THREE.BoxGeometry(0.08, 0.05, 0.03);
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.2 });
    const buckleMesh = new THREE.Mesh(buckleGeo, buckleMat);
    buckleMesh.position.set(0, 0.06, 0.12);
    pelvisGroup.add(buckleMesh);

    this.rootGroup.add(pelvisGroup);
    this.partMeshes.push({
      mesh: pelvisGroup,
      startNode: VerletRagdoll.PELVIS,
      endNode: VerletRagdoll.STOMACH,
      type: 'bone',
    });

    // 6. Left Arm (Bicep + Forearm + Hand)
    this.addLimb(
      VerletRagdoll.L_SHOULDER,
      VerletRagdoll.L_ELBOW,
      0.085,
      0.075,
      this.materials.suit,
      this.materials.armor
    );
    this.addLimb(
      VerletRagdoll.L_ELBOW,
      VerletRagdoll.L_HAND,
      0.075,
      0.065,
      this.materials.armor,
      this.materials.joint
    );

    // 7. Right Arm (Bicep + Forearm + Hand)
    this.addLimb(
      VerletRagdoll.R_SHOULDER,
      VerletRagdoll.R_ELBOW,
      0.085,
      0.075,
      this.materials.suit,
      this.materials.armor
    );
    this.addLimb(
      VerletRagdoll.R_ELBOW,
      VerletRagdoll.R_HAND,
      0.075,
      0.065,
      this.materials.armor,
      this.materials.joint
    );

    // 8. Left Leg (Thigh + Shin + Boot)
    this.addLimb(
      VerletRagdoll.L_HIP,
      VerletRagdoll.L_KNEE,
      0.11,
      0.095,
      this.materials.suit,
      this.materials.armor
    );
    this.addLimb(
      VerletRagdoll.L_KNEE,
      VerletRagdoll.L_FOOT,
      0.095,
      0.08,
      this.materials.boots,
      this.materials.boots
    );

    // 9. Right Leg (Thigh + Shin + Boot)
    this.addLimb(
      VerletRagdoll.R_HIP,
      VerletRagdoll.R_KNEE,
      0.11,
      0.095,
      this.materials.suit,
      this.materials.armor
    );
    this.addLimb(
      VerletRagdoll.R_KNEE,
      VerletRagdoll.R_FOOT,
      0.095,
      0.08,
      this.materials.boots,
      this.materials.boots
    );

    // Joint caps (shoulders, knees, elbows)
    const jointIndices = [
      VerletRagdoll.L_SHOULDER,
      VerletRagdoll.R_SHOULDER,
      VerletRagdoll.L_ELBOW,
      VerletRagdoll.R_ELBOW,
      VerletRagdoll.L_KNEE,
      VerletRagdoll.R_KNEE,
    ];

    const sphereGeo = new THREE.SphereGeometry(0.08, 12, 10);
    for (const jIdx of jointIndices) {
      const jointMesh = new THREE.Mesh(sphereGeo, this.materials.joint);
      jointMesh.castShadow = true;
      this.rootGroup.add(jointMesh);
      this.partMeshes.push({
        mesh: jointMesh,
        startNode: jIdx,
        type: 'joint',
      });
    }
  }

  private addLimb(
    startNode: number,
    endNode: number,
    rTop: number,
    rBottom: number,
    material: THREE.Material,
    accentMaterial: THREE.Material
  ) {
    const limbGroup = new THREE.Group();
    // Segment cylinder with length 1, scaled dynamically along Y
    const cylGeo = new THREE.CylinderGeometry(rBottom, rTop, 1.0, 12);
    cylGeo.translate(0, 0.5, 0); // pivot at base
    const cylMesh = new THREE.Mesh(cylGeo, material);
    cylMesh.castShadow = true;
    limbGroup.add(cylMesh);

    // Accent ring / pad
    const padGeo = new THREE.CylinderGeometry(rTop * 1.12, rTop * 1.12, 0.2, 12);
    padGeo.translate(0, 0.5, 0);
    const padMesh = new THREE.Mesh(padGeo, accentMaterial);
    limbGroup.add(padMesh);

    this.rootGroup.add(limbGroup);
    this.partMeshes.push({
      mesh: limbGroup,
      startNode,
      endNode,
      type: 'bone',
    });
  }

  private createSegmentMesh(r: number, _rBottom: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const cylGeo = new THREE.CylinderGeometry(r, r, 1.0, 12);
    cylGeo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(cylGeo, material);
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }

  private createSegmentBox(w: number, hRatio: number, d: number, material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(w, 1.0, d);
    boxGeo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }

  // Hitbox proxies for accurate bullet raycasting
  private buildHitboxes() {
    this.hitboxMeshes = [];

    const makeHitbox = (
      zone: HitZone,
      nodeIndex: number,
      secNodeIndex: number | undefined,
      geo: THREE.BufferGeometry,
      damageMultiplier: number
    ) => {
      const mesh = new THREE.Mesh(geo, this.materials.hitbox);
      mesh.userData = {
        isHitbox: true,
        zone,
        nodeIndex,
        secNodeIndex,
        damageMultiplier,
        ragdollId: this.ragdoll.id,
      };
      this.rootGroup.add(mesh);
      this.hitboxMeshes.push(mesh);
      return mesh;
    };

    // Head hitbox: sphere
    makeHitbox('head', VerletRagdoll.HEAD, undefined, new THREE.SphereGeometry(0.20, 10, 8), 3.5);

    // Neck hitbox
    makeHitbox('neck', VerletRagdoll.NECK, VerletRagdoll.HEAD, new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), 2.0);

    // Chest hitbox
    makeHitbox('chest', VerletRagdoll.CHEST, VerletRagdoll.NECK, new THREE.BoxGeometry(0.44, 1.0, 0.32), 1.3);

    // Spine/stomach
    makeHitbox('spine', VerletRagdoll.STOMACH, VerletRagdoll.CHEST, new THREE.BoxGeometry(0.38, 1.0, 0.28), 1.0);

    // Pelvis
    makeHitbox('pelvis', VerletRagdoll.PELVIS, VerletRagdoll.STOMACH, new THREE.BoxGeometry(0.40, 1.0, 0.30), 1.0);

    // Arms
    makeHitbox('left_arm', VerletRagdoll.L_SHOULDER, VerletRagdoll.L_ELBOW, new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8), 0.7);
    makeHitbox('left_arm', VerletRagdoll.L_ELBOW, VerletRagdoll.L_HAND, new THREE.CylinderGeometry(0.10, 0.10, 1.0, 8), 0.6);
    makeHitbox('right_arm', VerletRagdoll.R_SHOULDER, VerletRagdoll.R_ELBOW, new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8), 0.7);
    makeHitbox('right_arm', VerletRagdoll.R_ELBOW, VerletRagdoll.R_HAND, new THREE.CylinderGeometry(0.10, 0.10, 1.0, 8), 0.6);

    // Legs
    makeHitbox('left_leg', VerletRagdoll.L_HIP, VerletRagdoll.L_KNEE, new THREE.CylinderGeometry(0.13, 0.13, 1.0, 8), 0.8);
    makeHitbox('left_leg', VerletRagdoll.L_KNEE, VerletRagdoll.L_FOOT, new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), 0.7);
    makeHitbox('right_leg', VerletRagdoll.R_HIP, VerletRagdoll.R_KNEE, new THREE.CylinderGeometry(0.13, 0.13, 1.0, 8), 0.8);
    makeHitbox('right_leg', VerletRagdoll.R_KNEE, VerletRagdoll.R_FOOT, new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), 0.7);
  }

  // Update mesh transforms from Verlet nodes every frame
  public update(delta: number) {
    const nodes = this.ragdoll.nodes;

    // Update body parts
    for (const part of this.partMeshes) {
      if (part.type === 'head') {
        const headNode = nodes[part.startNode];
        const neckNode = nodes[VerletRagdoll.NECK];
        part.mesh.position.copy(headNode.pos);

        // Orient head from neck to head with look-at
        HumanoidMesh._dir.subVectors(headNode.pos, neckNode.pos).normalize();
        HumanoidMesh._quat.setFromUnitVectors(HumanoidMesh._up, HumanoidMesh._dir);
        part.mesh.quaternion.copy(HumanoidMesh._quat);
      } else if (part.type === 'joint') {
        part.mesh.position.copy(nodes[part.startNode].pos);
      } else if (part.type === 'bone' && part.endNode !== undefined) {
        const start = nodes[part.startNode].pos;
        const end = nodes[part.endNode].pos;

        // Position at start node
        part.mesh.position.copy(start);

        // Direction & distance
        HumanoidMesh._dir.subVectors(end, start);
        const dist = HumanoidMesh._dir.length();
        if (dist > 0.0001) {
          HumanoidMesh._dir.normalize();
          HumanoidMesh._quat.setFromUnitVectors(HumanoidMesh._up, HumanoidMesh._dir);
          part.mesh.quaternion.copy(HumanoidMesh._quat);
          part.mesh.scale.set(1, dist, 1);
        }
      }
    }

    // Update hitboxes to match positions and orientations
    for (const hMesh of this.hitboxMeshes) {
      const data = hMesh.userData;
      if (data.secNodeIndex !== undefined) {
        const start = nodes[data.nodeIndex].pos;
        const end = nodes[data.secNodeIndex].pos;

        // Midpoint
        HumanoidMesh._mid.addVectors(start, end).multiplyScalar(0.5);
        hMesh.position.copy(HumanoidMesh._mid);

        HumanoidMesh._dir.subVectors(end, start);
        const dist = HumanoidMesh._dir.length();
        if (dist > 0.001) {
          HumanoidMesh._dir.normalize();
          HumanoidMesh._quat.setFromUnitVectors(HumanoidMesh._up, HumanoidMesh._dir);
          hMesh.quaternion.copy(HumanoidMesh._quat);
          hMesh.scale.set(1, dist, 1);
        }
      } else {
        // Head / single node
        hMesh.position.copy(nodes[data.nodeIndex].pos);
      }
    }

    // Update hit flash timers
    for (const [mesh, timeLeft] of this.flashTimers.entries()) {
      const nextTime = timeLeft - delta;
      if (nextTime <= 0) {
        this.flashTimers.delete(mesh);
        // revert material or visibility
      } else {
        this.flashTimers.set(mesh, nextTime);
      }
    }
  }

  public setWireframeHitboxes(visible: boolean) {
    this.materials.hitbox.visible = visible;
  }

  public dispose() {
    this.materials.armor.dispose();
    this.materials.suit.dispose();
    this.materials.joint.dispose();
    this.materials.visor.dispose();
    this.materials.boots.dispose();
    this.materials.hitbox.dispose();
    this.materials.flashMaterial.dispose();
  }
}
