/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VerletRagdoll, ObstacleBox } from './physics/verletRagdoll';
import { HumanoidMesh } from './scene/humanoidMesh';
import { ProceduralGun } from './scene/proceduralGun';
import { ShootingRangeEnvironment } from './scene/environment';
import { ParticleSystem } from './scene/particles';
import { soundEngine } from './audio/soundEngine';
import { GameSettings, HitRecord, HitZone, WeaponType } from './types';
import { GameHUD } from './components/GameHUD';
import { TitleScreen } from './components/TitleScreen';
import { MobileControls } from './components/MobileControls';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Game Shell State
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused'>('title');
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('ak47');
  const [currentAmmo, setCurrentAmmo] = useState<number>(30);
  const [maxAmmo, setMaxAmmo] = useState<number>(30);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isAiming, setIsAiming] = useState<boolean>(false);
  const [isDragMode, setIsDragMode] = useState<boolean>(false);
  const [aliveCount, setAliveCount] = useState<number>(1);
  const [ragdollCount, setRagdollCount] = useState<number>(0);
  const [hitRecord, setHitRecord] = useState<HitRecord | null>(null);

  // Player combat stats
  const [playerHealth, setPlayerHealth] = useState<number>(100);
  const maxPlayerHealth = 100;
  const playerHealthRef = useRef<number>(100);
  const [kills, setKills] = useState<number>(0);
  const [hurtFlash, setHurtFlash] = useState<boolean>(false);

  // Settings with automatic mobile detection
  const [settings, setSettings] = useState<GameSettings>(() => {
    const isMobileDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 768 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

    return {
      language: 'uz',
      timeScale: 1.0,
      bulletTimeOnKill: true,
      gravity: -9.8,
      impactMultiplier: 1.4,
      soundEnabled: true,
      laserPointer: true,
      autoReload: true,
      hitboxWireframe: false,
      ragdollStiffness: 1.0,
      autoSpawn: true,
      autoSpawnInterval: 2.8,
      botAttackDamage: 15,
      touchControls: isMobileDevice,
    };
  });

  // Mobile virtual input refs
  const mobileMoveVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMobileFiringRef = useRef<boolean>(false);

  // Mutable refs to prevent stale closure bugs
  const gameStateRef = useRef<'title' | 'playing' | 'paused'>('title');
  const isDragModeRef = useRef<boolean>(false);
  const isAimingRef = useRef<boolean>(false);
  const currentWeaponRef = useRef<WeaponType>('ak47');
  const settingsRef = useRef<GameSettings>(settings);
  const autoSpawnTimerRef = useRef<number>(0);

  // Sync state to refs immediately
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isDragModeRef.current = isDragMode;
  }, [isDragMode]);

  useEffect(() => {
    isAimingRef.current = isAiming;
  }, [isAiming]);

  useEffect(() => {
    currentWeaponRef.current = currentWeapon;
  }, [currentWeapon]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Three.js scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gunRef = useRef<ProceduralGun | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const ragdollsRef = useRef<VerletRagdoll[]>([]);
  const humanoidMeshesRef = useRef<HumanoidMesh[]>([]);
  const obstaclesRef = useRef<ObstacleBox[]>([]);

  // Camera & Movement controls
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.65, 3.5));
  const cameraAnglesRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const keysHeldRef = useRef<{ [key: string]: boolean }>({});
  const isPointerLockedRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);
  const isRightMouseDownRef = useRef<boolean>(false);

  // Dragging ragdoll node with mouse or touch
  const draggedRagdollRef = useRef<VerletRagdoll | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const mouseRaycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const dragTetherLineRef = useRef<THREE.Line | null>(null);

  // Cinematic bullet time timer
  const bulletTimeTimerRef = useRef<number>(0);

  // Helper to sync counts
  const updateCounts = () => {
    let alive = 0;
    let dead = 0;
    for (const r of ragdollsRef.current) {
      if (r.state === 'ragdoll') dead++;
      else alive++;
    }
    setAliveCount(alive);
    setRagdollCount(dead);
  };

  // Add a dummy bot to the scene
  const addDummy = (id: string, pos: THREE.Vector3, orientation: number = 0) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const ragdoll = new VerletRagdoll(id, pos, orientation);
    const mesh = new HumanoidMesh(ragdoll);
    mesh.setWireframeHitboxes(settingsRef.current.hitboxWireframe);
    scene.add(mesh.rootGroup);

    ragdollsRef.current.push(ragdoll);
    humanoidMeshesRef.current.push(mesh);
  };

  // Spawn scenarios
  const spawnScenario = (scenario: 'single' | 'triple' | 'ledge' | 'patrol' | 'horde') => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up previous humanoid meshes
    for (const h of humanoidMeshesRef.current) {
      scene.remove(h.rootGroup);
      h.dispose();
    }
    ragdollsRef.current = [];
    humanoidMeshesRef.current = [];

    if (scenario === 'single') {
      addDummy('bot_1', new THREE.Vector3(0, 0, -12), 0);
    } else if (scenario === 'triple') {
      addDummy('bot_1', new THREE.Vector3(0, 0, -14), 0);
      addDummy('bot_2', new THREE.Vector3(-4.5, 0, -16), 0.2);
      addDummy('bot_3', new THREE.Vector3(4.5, 0, -16), -0.2);
    } else if (scenario === 'horde') {
      addDummy('bot_1', new THREE.Vector3(0, 0, -12), 0);
      addDummy('bot_2', new THREE.Vector3(-6, 0, -15), 0.3);
      addDummy('bot_3', new THREE.Vector3(6, 0, -15), -0.3);
      addDummy('bot_4', new THREE.Vector3(-3, 0, -20), 0.1);
      addDummy('bot_5', new THREE.Vector3(3, 0, -20), -0.1);
      addDummy('bot_6', new THREE.Vector3(0, 0, -24), 0);
    } else if (scenario === 'patrol') {
      addDummy('bot_left', new THREE.Vector3(-8, 0, -12), 0.4);
      addDummy('bot_right', new THREE.Vector3(8, 0, -12), -0.4);
    } else if (scenario === 'ledge') {
      addDummy('bot_1', new THREE.Vector3(-2, 0, -14), 0);
      addDummy('bot_2', new THREE.Vector3(2, 0, -14), 0);
    }

    updateCounts();
  };

  // Reset all current dummies
  const resetAllDummies = () => {
    const scene = sceneRef.current;
    if (scene) {
      for (const h of humanoidMeshesRef.current) {
        scene.remove(h.rootGroup);
        h.dispose();
      }
    }
    ragdollsRef.current = [];
    humanoidMeshesRef.current = [];
    particlesRef.current?.clear();
    spawnScenario('single');
  };

  // Player damaged by bot punch attack
  const handlePlayerDamaged = (damage: number) => {
    if (playerHealthRef.current <= 0) return;

    playerHealthRef.current = Math.max(0, playerHealthRef.current - damage);
    setPlayerHealth(playerHealthRef.current);

    // Audio
    soundEngine.playPunchSound();
    soundEngine.playPlayerHurt();

    // Visual red hurt screen flash
    setHurtFlash(true);
    setTimeout(() => setHurtFlash(false), 220);

    // Camera punch jolt
    cameraAnglesRef.current.pitch += (Math.random() - 0.5) * 0.06;
    cameraAnglesRef.current.yaw += (Math.random() - 0.5) * 0.06;
  };

  // Respawn after defeat
  const handleRespawn = () => {
    playerHealthRef.current = 100;
    setPlayerHealth(100);
    playerPosRef.current.set(0, 1.65, 3.5);
    cameraAnglesRef.current = { yaw: 0, pitch: 0 };
    resetAllDummies();
  };

  // Perform Gunshot
  const shootGun = () => {
    if (playerHealthRef.current <= 0) return;

    const gun = gunRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const particles = particlesRef.current;

    if (!gun || !camera || !scene || !particles) return;

    if (gun.currentAmmo <= 0) {
      soundEngine.playDryFire();
      if (settingsRef.current.autoReload) {
        gun.reload();
        setIsReloading(true);
        soundEngine.playReload();
      }
      return;
    }

    const fired = gun.fire();
    if (!fired) return;

    // Update ammo state
    setCurrentAmmo(gun.currentAmmo);

    // Audio
    soundEngine.playGunshot(gun.currentWeapon.soundType);

    // Eject shell casing
    const casingPos = new THREE.Vector3(0.02, -0.01, -0.05).applyMatrix4(gun.gunPivot.matrixWorld);
    const rightDir = new THREE.Vector3(1, 0.2, 0).applyEuler(camera.rotation).normalize();
    particles.emitCasing(casingPos, rightDir);

    // Bullet Raycast from center of camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Collect all hitboxes
    const hitboxes: THREE.Mesh[] = [];
    for (const hMesh of humanoidMeshesRef.current) {
      hitboxes.push(...hMesh.hitboxMeshes);
    }

    const intersects = raycaster.intersectObjects(hitboxes, false);

    // Compute tracer end point
    let hitPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(50));

    if (intersects.length > 0) {
      const hit = intersects[0];
      hitPoint = hit.point;

      const hitMesh = hit.object as THREE.Mesh;
      const hitData = hitMesh.userData as {
        zone: HitZone;
        ragdollId: string;
        damageMultiplier: number;
      };

      // Find hit ragdoll
      const ragdoll = ragdollsRef.current.find((r) => r.id === hitData.ragdollId);
      if (ragdoll) {
        const bulletVec = raycaster.ray.direction.clone();
        const rawDamage = gun.currentWeapon.damage * (hitData.damageMultiplier || 1.0);
        const impulse = gun.currentWeapon.impulseForce * settingsRef.current.impactMultiplier;

        const wasAlive = ragdoll.state === 'alive';
        const result = ragdoll.applyHit(
          hitData.zone,
          hit.point,
          bulletVec,
          impulse,
          rawDamage
        );

        if (wasAlive && result.isFatal) {
          setKills((prev) => prev + 1);
        }

        // Sound
        soundEngine.playHitSound(result.isFatal, result.zone);

        // Particles
        particles.emitHit(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), hitData.zone === 'head');

        // Record for HUD
        const rec: HitRecord = {
          id: Math.random().toString(),
          zone: hitData.zone,
          damage: Math.round(rawDamage),
          isFatal: result.isFatal,
          timestamp: Date.now(),
          force: Math.round(impulse),
        };
        setHitRecord(rec);

        // If fatal/headshot and bullet time on kill is enabled, trigger dramatic slow-mo
        if (result.isFatal && settingsRef.current.bulletTimeOnKill) {
          bulletTimeTimerRef.current = 1.3;
          soundEngine.playBulletTime(true);
        }

        updateCounts();
      }
    } else {
      // Raycast against floor to create impact dust/sparks
      const envHits = raycaster.intersectObjects(scene.children, true);
      const envHit = envHits.find((h) => !hitboxes.includes(h.object as THREE.Mesh));
      if (envHit) {
        hitPoint = envHit.point;
        particles.emitHit(envHit.point, envHit.face ? envHit.face.normal : new THREE.Vector3(0, 1, 0), false);
      }
    }

    // Tracer line from muzzle to hit point
    const muzzleWorld = new THREE.Vector3();
    gun.muzzleFlashMesh.getWorldPosition(muzzleWorld);
    particles.emitTracer(muzzleWorld, hitPoint);
  };

  // Mobile Handlers
  const handleCameraLookDelta = (dx: number, dy: number) => {
    const sensitivity = 0.0032;
    cameraAnglesRef.current.yaw -= dx * sensitivity;
    cameraAnglesRef.current.pitch -= dy * sensitivity;
    cameraAnglesRef.current.pitch = Math.max(
      -Math.PI * 0.42,
      Math.min(Math.PI * 0.42, cameraAnglesRef.current.pitch)
    );
  };

  const handleMobileFirePress = () => {
    isMobileFiringRef.current = true;
    shootGun();
  };

  const handleMobileFireRelease = () => {
    isMobileFiringRef.current = false;
  };

  // Reload gun
  const handleReload = () => {
    const gun = gunRef.current;
    if (!gun || gun.isReloading || gun.currentAmmo === gun.currentWeapon.magazineSize) return;
    gun.reload();
    setIsReloading(true);
    soundEngine.playReload();
  };

  // Change Weapon
  const handleSelectWeapon = (w: WeaponType) => {
    setCurrentWeapon(w);
    currentWeaponRef.current = w;
    const gun = gunRef.current;
    if (gun) {
      gun.setWeapon(w);
      gun.setLaserVisible(settingsRef.current.laserPointer);
      setCurrentAmmo(gun.currentAmmo);
      setMaxAmmo(gun.currentWeapon.magazineSize);
      setIsReloading(false);
    }
  };

  // Toggle Pointer Lock
  const togglePointerLock = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      renderer.domElement.requestPointerLock();
    }
  };

  // Setup Three.js Scene Lifecycle
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10141c);
    scene.fog = new THREE.FogExp2(0x10141c, 0.022);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      65,
      mount.clientWidth / mount.clientHeight,
      0.05,
      120
    );
    camera.position.copy(playerPosRef.current);
    cameraRef.current = camera;

    // 3. Renderer with PBR settings
    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isHeadless;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Studio Environment map via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff0dd, 2.4);
    keyLight.position.set(8, 14, 6);
    keyLight.castShadow = !isHeadless;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 15;
    keyLight.shadow.camera.bottom = -15;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x7395b0, 0x161a24, 1.2);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-10, 6, -20);
    scene.add(rimLight);

    // 5. Open Arena Environment (Obstacle-Free)
    const env = new ShootingRangeEnvironment();
    scene.add(env.group);
    obstaclesRef.current = [];

    // 6. Particles
    const particles = new ParticleSystem();
    scene.add(particles.group);
    particlesRef.current = particles;

    // 7. Gun (Defaults to AK-47 assault rifle)
    const gun = new ProceduralGun(currentWeaponRef.current);
    gun.setLaserVisible(settingsRef.current.laserPointer);
    camera.add(gun.rootGroup);
    scene.add(camera);
    gunRef.current = gun;

    // 8. Visual drag tether line
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    const tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const tetherLine = new THREE.Line(tetherGeo, tetherMat);
    tetherLine.visible = false;
    scene.add(tetherLine);
    dragTetherLineRef.current = tetherLine;

    // 9. Spawn initial attacking bot
    spawnScenario('single');

    // Pre-warm shaders
    renderer.compile(scene, camera);

    // 10. Pointer Lock Event Handlers
    const onPointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === renderer.domElement;
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    // 11. Desktop Keyboard Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      keysHeldRef.current[e.code] = true;
      if (e.key) keysHeldRef.current[e.key.toLowerCase()] = true;

      if (e.code === 'KeyR') {
        handleReload();
      } else if (e.code === 'Digit1') {
        handleSelectWeapon('9mm');
      } else if (e.code === 'Digit2') {
        handleSelectWeapon('deagle');
      } else if (e.code === 'Digit3') {
        handleSelectWeapon('silenced');
      } else if (e.code === 'Digit4') {
        handleSelectWeapon('auto');
      } else if (e.code === 'Digit5') {
        handleSelectWeapon('ak47');
      } else if (e.code === 'Space') {
        e.preventDefault();
        shootGun();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current[e.code] = false;
      if (e.key) keysHeldRef.current[e.key.toLowerCase()] = false;
    };

    const onWindowBlur = () => {
      keysHeldRef.current = {};
    };

    // 12. Desktop Mouse Listeners
    const onMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('label') ||
          target.closest('a') ||
          target.closest('[role="button"]') ||
          target.closest('.pointer-events-auto'))
      ) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseRaycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      if (e.button === 0) {
        // Left Click
        isMouseDownRef.current = true;

        const hitboxes: THREE.Mesh[] = [];
        for (const hMesh of humanoidMeshesRef.current) {
          hitboxes.push(...hMesh.hitboxMeshes);
        }

        const hits = mouseRaycasterRef.current.intersectObjects(hitboxes, false);

        if (isDragModeRef.current || e.altKey) {
          // Dedicated Drag Mode
          if (hits.length > 0) {
            const hit = hits[0];
            const hitData = hit.object.userData;
            const ragdoll = ragdollsRef.current.find((r) => r.id === hitData.ragdollId);
            if (ragdoll) {
              ragdoll.isDragged = true;
              ragdoll.draggedNodeIndex = hitData.nodeIndex;
              ragdoll.state = 'ragdoll';
              ragdoll.dragTarget.copy(hit.point);
              draggedRagdollRef.current = ragdoll;

              const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
              dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, hit.point);
              return;
            }
          }

          // Proximity fallback check
          for (const ragdoll of ragdollsRef.current) {
            for (let i = 0; i < ragdoll.nodes.length; i++) {
              const node = ragdoll.nodes[i];
              const dist = mouseRaycasterRef.current.ray.distanceToPoint(node.pos);
              if (dist < 0.8) {
                ragdoll.isDragged = true;
                ragdoll.draggedNodeIndex = i;
                ragdoll.state = 'ragdoll';
                ragdoll.dragTarget.copy(node.pos);
                draggedRagdollRef.current = ragdoll;

                const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
                dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, node.pos);
                return;
              }
            }
          }
          return;
        }

        // Standard Weapon Mode: Left click fires gun
        shootGun();
      } else if (e.button === 2) {
        // Right Click: Aim down sights (ADS)
        e.preventDefault();
        isRightMouseDownRef.current = true;
        setIsAiming(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDownRef.current = false;
        if (draggedRagdollRef.current) {
          draggedRagdollRef.current.isDragged = false;
          draggedRagdollRef.current.draggedNodeIndex = -1;
          draggedRagdollRef.current = null;
        }
        if (dragTetherLineRef.current) {
          dragTetherLineRef.current.visible = false;
        }
      } else if (e.button === 2) {
        isRightMouseDownRef.current = false;
        setIsAiming(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;

      // Handle active ragdoll dragging
      if (draggedRagdollRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        mouseRaycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const intersectPoint = new THREE.Vector3();
        if (mouseRaycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
          intersectPoint.y = Math.max(0.1, intersectPoint.y);
          draggedRagdollRef.current.dragTarget.copy(intersectPoint);

          if (dragTetherLineRef.current && draggedRagdollRef.current.draggedNodeIndex >= 0) {
            const nodePos = draggedRagdollRef.current.nodes[draggedRagdollRef.current.draggedNodeIndex].pos;
            dragTetherLineRef.current.geometry.setFromPoints([nodePos, intersectPoint]);
            dragTetherLineRef.current.visible = true;
          }
        }
        return;
      }

      // Camera look
      if (
        isPointerLockedRef.current ||
        isRightMouseDownRef.current ||
        (isMouseDownRef.current && !isDragModeRef.current)
      ) {
        const sensitivity = 0.0024;
        cameraAnglesRef.current.yaw -= e.movementX * sensitivity;
        cameraAnglesRef.current.pitch -= e.movementY * sensitivity;
        cameraAnglesRef.current.pitch = Math.max(
          -Math.PI * 0.42,
          Math.min(Math.PI * 0.42, cameraAnglesRef.current.pitch)
        );
      }
    };

    // 13. Mobile Direct Touch Drag Handlers on Canvas
    const onCanvasTouchStart = (e: TouchEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('input') ||
          target.closest('.pointer-events-auto'))
      ) {
        return;
      }

      if (isDragModeRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        mouseRaycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        const hitboxes: THREE.Mesh[] = [];
        for (const hMesh of humanoidMeshesRef.current) {
          hitboxes.push(...hMesh.hitboxMeshes);
        }

        const hits = mouseRaycasterRef.current.intersectObjects(hitboxes, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const hitData = hit.object.userData;
          const ragdoll = ragdollsRef.current.find((r) => r.id === hitData.ragdollId);
          if (ragdoll) {
            ragdoll.isDragged = true;
            ragdoll.draggedNodeIndex = hitData.nodeIndex;
            ragdoll.state = 'ragdoll';
            ragdoll.dragTarget.copy(hit.point);
            draggedRagdollRef.current = ragdoll;

            const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
            dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, hit.point);
            return;
          }
        }

        // Proximity check
        for (const ragdoll of ragdollsRef.current) {
          for (let i = 0; i < ragdoll.nodes.length; i++) {
            const node = ragdoll.nodes[i];
            const dist = mouseRaycasterRef.current.ray.distanceToPoint(node.pos);
            if (dist < 1.0) {
              ragdoll.isDragged = true;
              ragdoll.draggedNodeIndex = i;
              ragdoll.state = 'ragdoll';
              ragdoll.dragTarget.copy(node.pos);
              draggedRagdollRef.current = ragdoll;

              const camDir = camera.getWorldDirection(new THREE.Vector3()).negate();
              dragPlaneRef.current.setFromNormalAndCoplanarPoint(camDir, node.pos);
              return;
            }
          }
        }
      }
    };

    const onCanvasTouchMove = (e: TouchEvent) => {
      if (draggedRagdollRef.current && e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        const mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        mouseRaycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const intersectPoint = new THREE.Vector3();
        if (mouseRaycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
          intersectPoint.y = Math.max(0.1, intersectPoint.y);
          draggedRagdollRef.current.dragTarget.copy(intersectPoint);

          if (dragTetherLineRef.current && draggedRagdollRef.current.draggedNodeIndex >= 0) {
            const nodePos = draggedRagdollRef.current.nodes[draggedRagdollRef.current.draggedNodeIndex].pos;
            dragTetherLineRef.current.geometry.setFromPoints([nodePos, intersectPoint]);
            dragTetherLineRef.current.visible = true;
          }
        }
      }
    };

    const onCanvasTouchEnd = () => {
      if (draggedRagdollRef.current) {
        draggedRagdollRef.current.isDragged = false;
        draggedRagdollRef.current.draggedNodeIndex = -1;
        draggedRagdollRef.current = null;
      }
      if (dragTetherLineRef.current) {
        dragTetherLineRef.current.visible = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onCanvasTouchStart, { passive: true });
    window.addEventListener('touchmove', onCanvasTouchMove, { passive: true });
    window.addEventListener('touchend', onCanvasTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onCanvasTouchEnd, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('resize', onResize);

    // 14. Animation & Simulation Loop
    let lastTime = performance.now();
    let animFrameId: number;

    const tick = () => {
      animFrameId = requestAnimationFrame(tick);

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      // Handle bullet time
      let effectiveDt = dt * settingsRef.current.timeScale;
      if (bulletTimeTimerRef.current > 0) {
        bulletTimeTimerRef.current -= dt;
        effectiveDt = dt * 0.12;
        if (bulletTimeTimerRef.current <= 0) {
          soundEngine.playBulletTime(false);
        }
      }

      // Continuous full-auto firing (for Auto-Glock and AK-47 on mouse hold or mobile button hold)
      if (
        (isMouseDownRef.current || isMobileFiringRef.current) &&
        (currentWeaponRef.current === 'auto' || currentWeaponRef.current === 'ak47') &&
        !isDragModeRef.current
      ) {
        shootGun();
      }

      // Camera orientation smoothing
      const targetQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(cameraAnglesRef.current.pitch, cameraAnglesRef.current.yaw, 0, 'YXZ')
      );
      camera.quaternion.slerp(targetQuat, 0.35);

      // Movement (WASD, Arrow Keys, and Mobile Virtual Joystick)
      if (gameStateRef.current === 'playing' && playerHealthRef.current > 0) {
        const k = keysHeldRef.current;
        const forwardPressed = k['KeyW'] || k['w'] || k['W'] || k['ArrowUp'];
        const backwardPressed = k['KeyS'] || k['s'] || k['S'] || k['ArrowDown'];
        const leftPressed = k['KeyA'] || k['a'] || k['A'] || k['ArrowLeft'];
        const rightPressed = k['KeyD'] || k['d'] || k['D'] || k['ArrowRight'];

        const moveSpeed = 5.5 * dt;
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, cameraAnglesRef.current.yaw, 0));
        const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, cameraAnglesRef.current.yaw, 0));
        const moveDir = new THREE.Vector3();

        if (forwardPressed) moveDir.add(forward);
        if (backwardPressed) moveDir.sub(forward);
        if (leftPressed) moveDir.sub(right);
        if (rightPressed) moveDir.add(right);

        // Add virtual joystick input from mobile
        if (mobileMoveVectorRef.current.x !== 0 || mobileMoveVectorRef.current.y !== 0) {
          moveDir.addScaledVector(forward, mobileMoveVectorRef.current.y);
          moveDir.addScaledVector(right, mobileMoveVectorRef.current.x);
        }

        if (moveDir.lengthSq() > 0.001) {
          moveDir.normalize();
          playerPosRef.current.addScaledVector(moveDir, moveSpeed);

          // Constrain player within wide open arena
          playerPosRef.current.x = Math.max(-20, Math.min(20, playerPosRef.current.x));
          playerPosRef.current.z = Math.max(-6, Math.min(15, playerPosRef.current.z));
        }

        camera.position.copy(playerPosRef.current);
      }

      // Continuous Autospawn waves
      if (settingsRef.current.autoSpawn && gameStateRef.current === 'playing' && playerHealthRef.current > 0) {
        autoSpawnTimerRef.current += effectiveDt;
        if (autoSpawnTimerRef.current >= settingsRef.current.autoSpawnInterval) {
          autoSpawnTimerRef.current = 0;
          const alive = ragdollsRef.current.filter((r) => r.state === 'alive').length;
          if (alive < 6) {
            const angle = Math.random() * Math.PI * 2;
            const spawnDist = 18 + Math.random() * 8;
            const sx = playerPosRef.current.x + Math.sin(angle) * spawnDist;
            const sz = playerPosRef.current.z - Math.abs(Math.cos(angle) * spawnDist);
            addDummy(`bot_${Date.now()}_${Math.random()}`, new THREE.Vector3(sx, 0, sz));
            updateCounts();
          }
        }
      }

      // Gun kinematics update
      const gunSwayX = Math.sin(now * 0.003) * 0.4;
      const gunSwayY = Math.cos(now * 0.004) * 0.4;
      gun.update(dt, isAimingRef.current, gunSwayX, gunSwayY);

      // Bot Combat & Ragdoll physics update
      for (let i = 0; i < ragdollsRef.current.length; i++) {
        const ragdoll = ragdollsRef.current[i];
        if (ragdoll.state === 'alive') {
          // Bot runs towards player and punches!
          ragdoll.updateBotCombat(effectiveDt, playerPosRef.current, (damage) => {
            handlePlayerDamaged(damage);
          });
        } else {
          // Physics ragdoll
          ragdoll.updatePhysics(
            effectiveDt,
            settingsRef.current.gravity,
            obstaclesRef.current,
            (intensity) => soundEngine.playBodyThud(intensity)
          );
        }
      }

      // Update humanoid meshes from ragdoll positions
      for (const hMesh of humanoidMeshesRef.current) {
        hMesh.update(dt);
      }

      // Particles update
      particles.update(effectiveDt);

      // Render
      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onCanvasTouchStart);
      window.removeEventListener('touchmove', onCanvasTouchMove);
      window.removeEventListener('touchend', onCanvasTouchEnd);
      window.removeEventListener('touchcancel', onCanvasTouchEnd);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', onResize);

      gun.dispose();
      renderer.dispose();
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync gun laser and settings
  useEffect(() => {
    if (gunRef.current) {
      gunRef.current.setLaserVisible(settings.laserPointer);
    }
  }, [settings.laserPointer]);

  useEffect(() => {
    soundEngine.setMuted(!settings.soundEnabled);
  }, [settings.soundEnabled]);

  useEffect(() => {
    for (const h of humanoidMeshesRef.current) {
      h.setWireframeHitboxes(settings.hitboxWireframe);
    }
  }, [settings.hitboxWireframe]);

  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans select-none touch-none">
      {/* 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        className={`absolute inset-0 w-full h-full touch-none ${
          isDragMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
      />

      {/* Game Shell: Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={() => setGameState('playing')}
          language={settings.language}
          onToggleLanguage={() =>
            setSettings((prev) => ({ ...prev, language: prev.language === 'uz' ? 'en' : 'uz' }))
          }
        />
      )}

      {/* Game Shell: Active Game HUD */}
      {gameState === 'playing' && (
        <>
          <GameHUD
            currentWeapon={currentWeapon}
            onSelectWeapon={handleSelectWeapon}
            currentAmmo={currentAmmo}
            maxAmmo={maxAmmo}
            isReloading={isReloading}
            onReload={handleReload}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onSpawnScenario={spawnScenario}
            onResetScene={resetAllDummies}
            hitRecord={hitRecord}
            isAiming={isAiming}
            onToggleAim={() => setIsAiming(!isAiming)}
            isDragMode={isDragMode}
            onToggleDragMode={() => setIsDragMode(!isDragMode)}
            onTogglePointerLock={togglePointerLock}
            aliveCount={aliveCount}
            ragdollCount={ragdollCount}
            playerHealth={playerHealth}
            maxPlayerHealth={maxPlayerHealth}
            kills={kills}
            hurtFlash={hurtFlash}
            onRespawn={handleRespawn}
          />

          {/* Mobile Touch Controls Overlay */}
          {settings.touchControls && (
            <MobileControls
              onMoveVector={(vx, vy) => {
                mobileMoveVectorRef.current = { x: vx, y: vy };
              }}
              onCameraLookDelta={handleCameraLookDelta}
              onFirePress={handleMobileFirePress}
              onFireRelease={handleMobileFireRelease}
              onAimToggle={() => setIsAiming(!isAiming)}
              isAiming={isAiming}
              onReload={handleReload}
              isReloading={isReloading}
              currentAmmo={currentAmmo}
              maxAmmo={maxAmmo}
              onDragToggle={() => setIsDragMode(!isDragMode)}
              isDragMode={isDragMode}
              isUz={settings.language === 'uz'}
              currentWeapon={currentWeapon}
              onSelectWeapon={handleSelectWeapon}
            />
          )}
        </>
      )}
    </div>
  );
}
