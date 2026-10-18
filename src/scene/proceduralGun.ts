import * as THREE from 'three';
import { WeaponConfig, WeaponType } from '../types';

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  '9mm': {
    id: '9mm',
    name: 'Tactical 9mm Combat',
    nameUz: 'Taktik 9mm To\'pponcha',
    damage: 45,
    impulseForce: 18.0,
    fireRate: 4.5,
    magazineSize: 15,
    recoilPower: 0.12,
    soundType: 'standard',
    color: '#3a4454',
    slideTravel: 0.045,
    barrelLength: 0.22,
    caliber: '9x19mm Parabellum',
  },
  'deagle': {
    id: 'deagle',
    name: '.50 Heavy Cannon (Deagle)',
    nameUz: '.50 Og\'ir Kalibr (Deagle)',
    damage: 110,
    impulseForce: 42.0, // massive ragdoll blast!
    fireRate: 2.2,
    magazineSize: 7,
    recoilPower: 0.32,
    soundType: 'heavy',
    color: '#c0c5cc',
    slideTravel: 0.065,
    barrelLength: 0.28,
    caliber: '.50 Action Express',
  },
  'silenced': {
    id: 'silenced',
    name: 'Covert 9mm Suppressed',
    nameUz: 'Ovoz So\'ndirgichli 9mm',
    damage: 40,
    impulseForce: 15.0,
    fireRate: 5.0,
    magazineSize: 18,
    recoilPower: 0.08,
    soundType: 'suppressed',
    color: '#20232a',
    slideTravel: 0.04,
    barrelLength: 0.34,
    caliber: '9mm Subsonic',
  },
  'auto': {
    id: 'auto',
    name: 'Rapid Auto-Pistol G18',
    nameUz: 'Avtomat Tezotar To\'pponcha',
    damage: 32,
    impulseForce: 14.0,
    fireRate: 11.0,
    magazineSize: 30,
    recoilPower: 0.15,
    soundType: 'standard',
    color: '#2a3b32',
    slideTravel: 0.045,
    barrelLength: 0.23,
    caliber: '9x19mm Auto',
  },
  'ak47': {
    id: 'ak47',
    name: 'AK-47 Tactical Rifle',
    nameUz: 'AK-47 Avtomat',
    damage: 60,
    impulseForce: 30.0,
    fireRate: 9.5,
    magazineSize: 30,
    recoilPower: 0.22,
    soundType: 'rifle',
    color: '#8b4513',
    slideTravel: 0.06,
    barrelLength: 0.58,
    caliber: '7.62x39mm Soviet',
  },
};

export class ProceduralGun {
  public rootGroup: THREE.Group;
  public gunPivot: THREE.Group;
  public slideGroup: THREE.Group;
  public muzzlePoint: THREE.Vector3 = new THREE.Vector3();
  public laserLine: THREE.Line | null = null;
  public muzzleLight: THREE.PointLight;
  public muzzleFlashMesh: THREE.Group;

  public currentWeapon: WeaponConfig;
  public currentAmmo: number;
  public isReloading: boolean = false;
  
  // Recoil kinematics
  private recoilZ: number = 0;
  private recoilRotX: number = 0;
  private recoilRotY: number = 0;
  private slideOffsetZ: number = 0;
  private flashTimer: number = 0;
  private reloadTimer: number = 0;
  private lastShotTime: number = 0;

  // Aim down sights (ADS)
  public isAiming: boolean = false;
  private currentHipPos = new THREE.Vector3(0.24, -0.22, -0.48);
  private currentAdsPos = new THREE.Vector3(0.0, -0.138, -0.38);
  private currentAimProgress: number = 0; // 0 = hip, 1 = ADS

  constructor(weaponType: WeaponType = '9mm') {
    this.currentWeapon = WEAPON_CONFIGS[weaponType] || WEAPON_CONFIGS['9mm'];
    this.currentAmmo = this.currentWeapon.magazineSize;

    this.rootGroup = new THREE.Group();
    this.gunPivot = new THREE.Group();
    this.slideGroup = new THREE.Group();

    this.rootGroup.add(this.gunPivot);

    // Muzzle light
    this.muzzleLight = new THREE.PointLight(0xffaa44, 0, 9);
    this.rootGroup.add(this.muzzleLight);

    // Procedural muzzle flash geometry
    this.muzzleFlashMesh = this.createMuzzleFlash();
    this.muzzleFlashMesh.visible = false;
    this.rootGroup.add(this.muzzleFlashMesh);

    this.buildGun();
    this.buildLaserSight();
  }

  public setWeapon(type: WeaponType) {
    this.currentWeapon = WEAPON_CONFIGS[type] || WEAPON_CONFIGS['9mm'];
    this.currentAmmo = this.currentWeapon.magazineSize;
    this.isReloading = false;
    this.reloadTimer = 0;

    // Adjust ADS alignment based on rifle vs pistol
    if (this.currentWeapon.id === 'ak47') {
      this.currentHipPos.set(0.25, -0.25, -0.55);
      this.currentAdsPos.set(0.0, -0.165, -0.45);
    } else {
      this.currentHipPos.set(0.24, -0.22, -0.48);
      this.currentAdsPos.set(0.0, -0.138, -0.38);
    }

    // Clear previous geometry
    while (this.gunPivot.children.length > 0) {
      this.gunPivot.remove(this.gunPivot.children[0]);
    }
    this.slideGroup = new THREE.Group();
    this.buildGun();
  }

  private buildGun() {
    const isAk = this.currentWeapon.id === 'ak47';
    const isDeagle = this.currentWeapon.id === 'deagle';
    const isSilenced = this.currentWeapon.id === 'silenced';

    // Materials
    const steelMat = new THREE.MeshStandardMaterial({
      color: isDeagle ? 0xd0d8e2 : isSilenced ? 0x181a20 : 0x222630,
      metalness: isDeagle ? 0.95 : 0.88,
      roughness: isDeagle ? 0.15 : 0.35,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513, // Russian laminate wood
      roughness: 0.65,
      metalness: 0.08,
    });

    const polymerMat = new THREE.MeshStandardMaterial({
      color: 0x15171c,
      roughness: 0.78,
      metalness: 0.08,
    });

    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x333842,
      metalness: 0.92,
      roughness: 0.25,
    });

    const sightDotMat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
    });

    if (isAk) {
      // ===== AK-47 ASSAULT RIFLE COMPOSITE 3D MODEL =====
      // 1. Stamped Steel Receiver
      const recGeo = new THREE.BoxGeometry(0.052, 0.085, 0.32);
      const recMesh = new THREE.Mesh(recGeo, steelMat);
      recMesh.position.set(0, 0, 0);
      recMesh.castShadow = true;
      this.gunPivot.add(recMesh);

      // Top dust cover
      const dustGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.30, 12, 1, false, 0, Math.PI);
      dustGeo.rotateX(Math.PI / 2);
      dustGeo.rotateY(Math.PI / 2);
      const dustMesh = new THREE.Mesh(dustGeo, steelMat);
      dustMesh.position.set(0, 0.042, 0);
      dustMesh.castShadow = true;
      this.gunPivot.add(dustMesh);

      // 2. Wooden Buttstock
      const stockGeo = new THREE.BoxGeometry(0.042, 0.12, 0.28);
      const stockMesh = new THREE.Mesh(stockGeo, woodMat);
      stockMesh.position.set(0, -0.04, 0.28);
      stockMesh.rotation.x = -0.12;
      stockMesh.castShadow = true;
      this.gunPivot.add(stockMesh);

      // Stock buttplate
      const buttGeo = new THREE.BoxGeometry(0.044, 0.13, 0.015);
      const buttMesh = new THREE.Mesh(buttGeo, steelMat);
      buttMesh.position.set(0, -0.055, 0.42);
      this.gunPivot.add(buttMesh);

      // 3. Ergonomic Wooden Pistol Grip
      const gripGeo = new THREE.BoxGeometry(0.038, 0.13, 0.055);
      const gripMesh = new THREE.Mesh(gripGeo, woodMat);
      gripMesh.position.set(0, -0.09, 0.08);
      gripMesh.rotation.x = -0.32;
      gripMesh.castShadow = true;
      this.gunPivot.add(gripMesh);

      // Trigger Guard & Trigger
      const guardGeo = new THREE.TorusGeometry(0.03, 0.005, 8, 16, Math.PI * 1.15);
      const guardMesh = new THREE.Mesh(guardGeo, steelMat);
      guardMesh.rotation.y = Math.PI / 2;
      guardMesh.position.set(0, -0.055, 0.02);
      this.gunPivot.add(guardMesh);

      const triggerGeo = new THREE.BoxGeometry(0.006, 0.022, 0.012);
      const triggerMesh = new THREE.Mesh(triggerGeo, steelMat);
      triggerMesh.position.set(0, -0.052, 0.025);
      this.gunPivot.add(triggerMesh);

      // 4. Curved 30-round Banana Magazine
      const magGroup = new THREE.Group();
      const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.10, 0.07), steelMat);
      magUpper.position.set(0, -0.08, -0.05);
      magUpper.rotation.x = 0.25;
      magGroup.add(magUpper);

      const magLower = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.12, 0.065), steelMat);
      magLower.position.set(0, -0.17, -0.075);
      magLower.rotation.x = 0.42;
      magGroup.add(magLower);
      this.gunPivot.add(magGroup);

      // 5. Wooden Handguard & Gas Tube
      const handguardGeo = new THREE.BoxGeometry(0.052, 0.065, 0.22);
      const handguardMesh = new THREE.Mesh(handguardGeo, woodMat);
      handguardMesh.position.set(0, 0.01, -0.26);
      handguardMesh.castShadow = true;
      this.gunPivot.add(handguardMesh);

      // Gas tube (above handguard)
      const gasGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.26, 12);
      gasGeo.rotateX(Math.PI / 2);
      const gasMesh = new THREE.Mesh(gasGeo, steelMat);
      gasMesh.position.set(0, 0.045, -0.27);
      this.gunPivot.add(gasMesh);

      // 6. Long Barrel & Slanted Muzzle Brake
      const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 12);
      barrelGeo.rotateX(Math.PI / 2);
      const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
      barrelMesh.position.set(0, 0.018, -0.48);
      barrelMesh.castShadow = true;
      this.gunPivot.add(barrelMesh);

      // Front sight block
      const frontSightGeo = new THREE.BoxGeometry(0.014, 0.06, 0.035);
      const frontSightMesh = new THREE.Mesh(frontSightGeo, steelMat);
      frontSightMesh.position.set(0, 0.055, -0.58);
      this.gunPivot.add(frontSightMesh);

      // Sight post dot
      const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), sightDotMat);
      frontDot.position.set(0, 0.082, -0.58);
      this.gunPivot.add(frontDot);

      // Slanted muzzle brake
      const brakeGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12);
      brakeGeo.rotateX(Math.PI / 2);
      const brakeMesh = new THREE.Mesh(brakeGeo, steelMat);
      brakeMesh.position.set(0, 0.018, -0.66);
      this.gunPivot.add(brakeMesh);

      // 7. Bolt Carrier & Charging Handle (Animated on slideGroup)
      this.slideGroup = new THREE.Group();
      const boltHandleGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.035, 8);
      boltHandleGeo.rotateZ(Math.PI / 2);
      const boltHandleMesh = new THREE.Mesh(boltHandleGeo, steelMat);
      boltHandleMesh.position.set(0.038, 0.02, -0.02);
      this.slideGroup.add(boltHandleMesh);
      this.gunPivot.add(this.slideGroup);

      this.muzzlePoint.set(0, 0.018, -0.69);
    } else {
      // ===== PISTOL MODELS (9mm, Desert Eagle, Silenced, Auto) =====
      // 1. Lower Frame & Receiver
      const frameGeo = new THREE.BoxGeometry(0.042, 0.055, this.currentWeapon.barrelLength);
      const frameMesh = new THREE.Mesh(frameGeo, polymerMat);
      frameMesh.position.set(0, -0.015, -0.04);
      frameMesh.castShadow = true;
      this.gunPivot.add(frameMesh);

      // 2. Pistol Grip
      const gripGeo = new THREE.BoxGeometry(0.04, 0.14, 0.065);
      const gripMesh = new THREE.Mesh(gripGeo, polymerMat);
      gripMesh.position.set(0, -0.10, 0.04);
      gripMesh.rotation.x = -0.25;
      gripMesh.castShadow = true;
      this.gunPivot.add(gripMesh);

      // Side panels
      const panelGeo = new THREE.BoxGeometry(0.044, 0.11, 0.05);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.9, metalness: 0.05 });
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.copy(gripMesh.position);
      panelMesh.rotation.copy(gripMesh.rotation);
      this.gunPivot.add(panelMesh);

      // 3. Trigger Guard & Trigger
      const guardGeo = new THREE.TorusGeometry(0.032, 0.005, 8, 16, Math.PI * 1.15);
      const guardMesh = new THREE.Mesh(guardGeo, steelMat);
      guardMesh.rotation.y = Math.PI / 2;
      guardMesh.rotation.x = 0.3;
      guardMesh.position.set(0, -0.052, -0.035);
      this.gunPivot.add(guardMesh);

      const triggerGeo = new THREE.BoxGeometry(0.006, 0.024, 0.014);
      const triggerMesh = new THREE.Mesh(triggerGeo, steelMat);
      triggerMesh.position.set(0, -0.048, -0.022);
      triggerMesh.rotation.x = 0.2;
      this.gunPivot.add(triggerMesh);

      // 4. Slide Assembly
      this.slideGroup = new THREE.Group();
      const slideWidth = isDeagle ? 0.048 : 0.042;
      const slideHeight = isDeagle ? 0.056 : 0.044;
      const slideGeo = new THREE.BoxGeometry(slideWidth, slideHeight, this.currentWeapon.barrelLength);
      const slideMesh = new THREE.Mesh(slideGeo, steelMat);
      slideMesh.position.set(0, 0.03, -0.04);
      slideMesh.castShadow = true;
      this.slideGroup.add(slideMesh);

      // Serrations
      const serGeo = new THREE.BoxGeometry(slideWidth * 1.02, slideHeight * 0.7, 0.035);
      const serMat = new THREE.MeshStandardMaterial({ color: 0x1d212a, roughness: 0.5, metalness: 0.9 });
      const serMesh = new THREE.Mesh(serGeo, serMat);
      serMesh.position.set(0, 0.03, 0.05);
      this.slideGroup.add(serMesh);

      // Sights
      const rearSightGeo = new THREE.BoxGeometry(0.03, 0.014, 0.012);
      const rearSightMesh = new THREE.Mesh(rearSightGeo, steelMat);
      rearSightMesh.position.set(0, 0.03 + slideHeight * 0.5 + 0.007, 0.065);
      this.slideGroup.add(rearSightMesh);

      const dotGeo = new THREE.SphereGeometry(0.0025, 8, 8);
      const leftDot = new THREE.Mesh(dotGeo, sightDotMat);
      leftDot.position.set(-0.01, 0.03 + slideHeight * 0.5 + 0.008, 0.071);
      const rightDot = new THREE.Mesh(dotGeo, sightDotMat);
      rightDot.position.set(0.01, 0.03 + slideHeight * 0.5 + 0.008, 0.071);
      this.slideGroup.add(leftDot);
      this.slideGroup.add(rightDot);

      const frontSightGeo = new THREE.BoxGeometry(0.008, 0.015, 0.012);
      const frontSightMesh = new THREE.Mesh(frontSightGeo, steelMat);
      const frontSightZ = -0.04 - this.currentWeapon.barrelLength * 0.5 + 0.015;
      frontSightMesh.position.set(0, 0.03 + slideHeight * 0.5 + 0.007, frontSightZ);
      this.slideGroup.add(frontSightMesh);

      const frontDot = new THREE.Mesh(dotGeo, sightDotMat);
      frontDot.position.set(0, 0.03 + slideHeight * 0.5 + 0.009, frontSightZ + 0.006);
      this.slideGroup.add(frontDot);

      this.gunPivot.add(this.slideGroup);

      // 5. Barrel & Muzzle
      const barrelRadius = isDeagle ? 0.016 : 0.012;
      const barrelZ = -0.04 - this.currentWeapon.barrelLength * 0.5;

      if (isSilenced) {
        const suppGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.18, 16);
        suppGeo.rotateX(Math.PI / 2);
        const suppMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.7 });
        const suppMesh = new THREE.Mesh(suppGeo, suppMat);
        suppMesh.position.set(0, 0.028, barrelZ - 0.08);
        suppMesh.castShadow = true;
        this.gunPivot.add(suppMesh);

        this.muzzlePoint.set(0, 0.028, barrelZ - 0.17);
      } else {
        const barrelMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(barrelRadius, barrelRadius, 0.06, 16).rotateX(Math.PI / 2),
          barrelMat
        );
        barrelMesh.position.set(0, 0.028, barrelZ - 0.02);
        this.gunPivot.add(barrelMesh);

        this.muzzlePoint.set(0, 0.028, barrelZ - 0.055);
      }
    }

    // Position muzzle light & flash
    this.muzzleLight.position.copy(this.muzzlePoint);
    this.muzzleFlashMesh.position.copy(this.muzzlePoint);
  }

  private createMuzzleFlash(): THREE.Group {
    const flashGroup = new THREE.Group();

    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe077,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    const planeGeo = new THREE.PlaneGeometry(0.20, 0.20);
    const plane1 = new THREE.Mesh(planeGeo, flashMat);
    plane1.rotation.z = Math.PI / 4;
    const plane2 = new THREE.Mesh(planeGeo, flashMat);
    plane2.rotation.z = -Math.PI / 4;

    flashGroup.add(plane1);
    flashGroup.add(plane2);

    const coreGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    flashGroup.add(core);

    return flashGroup;
  }

  private buildLaserSight() {
    const laserMat = new THREE.LineBasicMaterial({
      color: 0xff1122,
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
    });
    const points = [new THREE.Vector3(0, -0.042, -0.07), new THREE.Vector3(0, 0, -40)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    this.laserLine = new THREE.Line(geo, laserMat);
    this.laserLine.visible = false;
    this.gunPivot.add(this.laserLine);
  }

  public setLaserVisible(visible: boolean) {
    if (this.laserLine) {
      this.laserLine.visible = visible;
    }
  }

  public canShoot(): boolean {
    if (this.isReloading) return false;
    if (this.currentAmmo <= 0) return false;
    const now = performance.now() / 1000;
    const minInterval = 1.0 / this.currentWeapon.fireRate;
    return now - this.lastShotTime >= minInterval;
  }

  public fire(): boolean {
    if (!this.canShoot()) return false;

    this.currentAmmo--;
    this.lastShotTime = performance.now() / 1000;

    // Apply recoil impulse
    const p = this.currentWeapon.recoilPower;
    this.recoilZ = p * 0.7;
    this.recoilRotX = p * 1.8;
    this.recoilRotY = (Math.random() - 0.5) * p * 0.4;
    this.slideOffsetZ = this.currentWeapon.slideTravel;

    // Flash
    this.flashTimer = 0.05;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    this.muzzleLight.intensity = this.currentWeapon.soundType === 'heavy' || this.currentWeapon.soundType === 'rifle' ? 14 : 6;

    return true;
  }

  public reload() {
    if (this.isReloading || this.currentAmmo === this.currentWeapon.magazineSize) return;
    this.isReloading = true;
    this.reloadTimer = this.currentWeapon.id === 'ak47' ? 1.6 : 1.2;
  }

  public update(delta: number, isAiming: boolean, swayX: number = 0, swayY: number = 0) {
    this.isAiming = isAiming;

    const targetAim = isAiming ? 1.0 : 0.0;
    this.currentAimProgress = THREE.MathUtils.damp(this.currentAimProgress, targetAim, 12, delta);

    const targetBasePos = new THREE.Vector3().lerpVectors(
      this.currentHipPos,
      this.currentAdsPos,
      this.currentAimProgress
    );

    targetBasePos.x += swayX * 0.015;
    targetBasePos.y += swayY * 0.015;

    this.recoilZ = THREE.MathUtils.damp(this.recoilZ, 0, 24, delta);
    this.recoilRotX = THREE.MathUtils.damp(this.recoilRotX, 0, 18, delta);
    this.recoilRotY = THREE.MathUtils.damp(this.recoilRotY, 0, 20, delta);
    this.slideOffsetZ = THREE.MathUtils.damp(this.slideOffsetZ, 0, 32, delta);

    this.rootGroup.position.copy(targetBasePos);
    this.rootGroup.position.z += this.recoilZ;

    this.gunPivot.rotation.x = this.recoilRotX;
    this.gunPivot.rotation.y = this.recoilRotY;

    this.slideGroup.position.z = this.slideOffsetZ;

    // Reload animation dip
    if (this.isReloading) {
      const totalTime = this.currentWeapon.id === 'ak47' ? 1.6 : 1.2;
      this.reloadTimer -= delta;
      const progress = 1.0 - this.reloadTimer / totalTime;
      const dipAngle = Math.sin(progress * Math.PI) * 0.5;
      this.gunPivot.rotation.x += dipAngle;
      this.gunPivot.rotation.z += dipAngle * 0.35;
      this.rootGroup.position.y -= dipAngle * 0.18;

      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.currentAmmo = this.currentWeapon.magazineSize;
      }
    }

    // Muzzle flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      if (this.flashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }
  }

  public dispose() {
    this.muzzleLight.dispose();
  }
}
