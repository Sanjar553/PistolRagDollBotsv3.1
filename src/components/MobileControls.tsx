import React, { useRef, useState, useEffect } from 'react';
import { Crosshair, Eye, RefreshCw, Hand, ShieldAlert } from 'lucide-react';
import { WeaponType } from '../types';
import { WEAPON_CONFIGS } from '../scene/proceduralGun';

interface MobileControlsProps {
  onMoveVector: (vx: number, vy: number) => void;
  onCameraLookDelta: (dx: number, dy: number) => void;
  onFirePress: () => void;
  onFireRelease: () => void;
  onAimToggle: () => void;
  isAiming: boolean;
  onReload: () => void;
  isReloading: boolean;
  currentAmmo: number;
  maxAmmo: number;
  onDragToggle: () => void;
  isDragMode: boolean;
  isUz: boolean;
  currentWeapon: WeaponType;
  onSelectWeapon: (w: WeaponType) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMoveVector,
  onCameraLookDelta,
  onFirePress,
  onFireRelease,
  onAimToggle,
  isAiming,
  onReload,
  isReloading,
  currentAmmo,
  maxAmmo,
  onDragToggle,
  isDragMode,
  isUz,
  currentWeapon,
  onSelectWeapon,
}) => {
  // Joystick state
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera look touch tracking
  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle Joystick Touch
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;

    if (joystickBaseRef.current) {
      const rect = joystickBaseRef.current.getBoundingClientRect();
      joystickCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateJoystick(touch.clientX, touch.clientY);
    }
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const maxRadius = 45;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: clampedX, y: clampedY });

    // Normalize -1 to 1 (x: strafe right/left, y: forward/backward)
    // dy negative is forward in 3D
    const normX = clampedX / maxRadius;
    const normY = -(clampedY / maxRadius);
    onMoveVector(normX, normY);
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickPos({ x: 0, y: 0 });
        onMoveVector(0, 0);
        break;
      }
    }
  };

  // Handle Right-Half Look Touch Area
  const handleLookTouchStart = (e: React.TouchEvent) => {
    // If user is touching buttons inside, don't trigger look
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) return;

    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lookLastPosRef.current.x;
        const dy = touch.clientY - lookLastPosRef.current.y;
        lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
        onCameraLookDelta(dx, dy);
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  const weaponsList: WeaponType[] = ['9mm', 'deagle', 'silenced', 'auto', 'ak47'];

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 overflow-hidden font-sans">
      {/* Right-Screen Camera Look Pad (only intercepts touch for looking when drag mode is off) */}
      {!isDragMode && (
        <div
          className="absolute top-16 right-0 w-3/5 h-3/4 pointer-events-auto touch-none"
          onTouchStart={handleLookTouchStart}
          onTouchMove={handleLookTouchMove}
          onTouchEnd={handleLookTouchEnd}
          onTouchCancel={handleLookTouchEnd}
        />
      )}

      {/* Quick Mobile Weapon Bar (Top-Right or Just below top bar) */}
      <div
        className="absolute top-16 right-4 flex items-center gap-1 bg-neutral-950/80 p-1 rounded-xl border border-neutral-700/80 shadow-2xl backdrop-blur-sm pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {weaponsList.map((wId) => {
          const w = WEAPON_CONFIGS[wId];
          const isSelected = currentWeapon === wId;
          const isRifle = wId === 'ak47';
          return (
            <button
              key={wId}
              onClick={() => onSelectWeapon(wId)}
              onTouchStart={(e) => {
                e.stopPropagation();
                onSelectWeapon(wId);
              }}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all min-h-[36px] flex flex-col items-center justify-center ${
                isSelected
                  ? isRifle
                    ? 'bg-amber-500 text-neutral-950 shadow-md ring-1 ring-amber-300'
                    : 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400'
                  : 'bg-neutral-900/90 text-neutral-300 hover:text-white border border-neutral-800'
              }`}
            >
              <span>{wId === 'ak47' ? 'AK-47' : w.caliber}</span>
              <span className="text-[8px] opacity-75">{wId === 'auto' ? 'AUTO' : wId}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom-Left Virtual Movement Joystick */}
      <div className="absolute bottom-6 left-5 pointer-events-auto">
        <div
          ref={joystickBaseRef}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
          className="relative w-28 h-28 rounded-full bg-neutral-900/70 border-2 border-neutral-600/70 shadow-2xl flex items-center justify-center touch-none backdrop-blur-md"
        >
          {/* Subtle directional indicators */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-neutral-400/80" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-neutral-400/80" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-neutral-400/80" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-neutral-400/80" />

          {/* Draggable thumb knob */}
          <div
            className="w-12 h-12 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-xl border border-amber-300 flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
            }}
          >
            <div className="w-4 h-4 rounded-full bg-neutral-950/40" />
          </div>
        </div>
      </div>

      {/* Right-Side Action Cluster (Fire, ADS, Reload, Drag) */}
      <div
        className="absolute bottom-6 right-5 flex flex-col items-end gap-3 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Upper Row: ADS & Drag & Reload */}
        <div className="flex items-center gap-2.5">
          {/* Drag Ragdoll Toggle Button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              onDragToggle();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDragToggle();
            }}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border shadow-xl transition-all active:scale-90 ${
              isDragMode
                ? 'bg-blue-600 border-blue-300 text-white shadow-blue-500/40'
                : 'bg-neutral-900/85 border-neutral-700/80 text-neutral-300'
            }`}
            title="Ragdoll Drag"
          >
            <Hand className="w-5 h-5" />
            <span className="text-[8px] font-bold mt-0.5 uppercase tracking-tighter">
              {isDragMode ? 'TORT' : 'DRAG'}
            </span>
          </button>

          {/* ADS Aim Button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              onAimToggle();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAimToggle();
            }}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border shadow-xl transition-all active:scale-90 ${
              isAiming
                ? 'bg-amber-500/40 border-amber-400 text-amber-200 shadow-amber-500/30'
                : 'bg-neutral-900/85 border-neutral-700/80 text-neutral-300'
            }`}
            title="Aim ADS"
          >
            <Eye className="w-5 h-5" />
            <span className="text-[8px] font-bold mt-0.5 uppercase tracking-tighter">
              {isUz ? 'NISHON' : 'AIM'}
            </span>
          </button>

          {/* Reload Button */}
          <button
            onTouchStart={(e) => {
              e.stopPropagation();
              onReload();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onReload();
            }}
            disabled={isReloading || currentAmmo === maxAmmo}
            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border shadow-xl transition-all active:scale-90 ${
              isReloading
                ? 'bg-amber-900/50 border-amber-500 text-amber-300 animate-spin'
                : 'bg-neutral-900/85 border-neutral-700/80 text-neutral-200'
            }`}
            title="Reload"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-[8px] font-bold mt-0.5 uppercase tracking-tighter">
              {isReloading ? '...' : isUz ? "O'Q" : 'REL'}
            </span>
          </button>
        </div>

        {/* Primary Big FIRE Button (Thumb accessible) */}
        <button
          onTouchStart={(e) => {
            e.stopPropagation();
            onFirePress();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onFireRelease();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onFirePress();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onFireRelease();
          }}
          className="w-20 h-20 rounded-full bg-gradient-to-tr from-red-700 via-red-600 to-amber-500 border-2 border-red-300/80 text-white shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-90 cursor-pointer touch-none"
        >
          <Crosshair className="w-8 h-8 drop-shadow" />
          <span className="text-[10px] font-black uppercase tracking-wider mt-0.5">
            {isUz ? 'OTISH' : 'FIRE'}
          </span>
        </button>
      </div>
    </div>
  );
};
