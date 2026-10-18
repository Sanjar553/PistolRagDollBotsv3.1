export type WeaponType = '9mm' | 'deagle' | 'silenced' | 'auto' | 'ak47';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  nameUz: string;
  damage: number;
  impulseForce: number;
  fireRate: number; // shots per sec
  magazineSize: number;
  recoilPower: number;
  soundType: 'standard' | 'heavy' | 'suppressed' | 'rifle';
  color: string;
  slideTravel: number;
  barrelLength: number;
  caliber: string;
}

export type HitZone =
  | 'head'
  | 'neck'
  | 'chest'
  | 'spine'
  | 'pelvis'
  | 'left_arm'
  | 'right_arm'
  | 'left_leg'
  | 'right_leg';

export interface HitRecord {
  id: string;
  zone: HitZone;
  damage: number;
  isFatal: boolean;
  timestamp: number;
  force: number;
}

export interface GameSettings {
  language: 'uz' | 'en';
  timeScale: number; // 1.0, 0.25, 0.05
  bulletTimeOnKill: boolean;
  gravity: number; // -9.8
  impactMultiplier: number; // 1.0 - 3.0
  soundEnabled: boolean;
  laserPointer: boolean;
  autoReload: boolean;
  hitboxWireframe: boolean;
  ragdollStiffness: number;
  autoSpawn: boolean;
  autoSpawnInterval: number; // in seconds
  botAttackDamage: number;
  touchControls: boolean;
}

export type SpawnScenario = 'single' | 'triple' | 'ledge' | 'patrol' | 'horde';
