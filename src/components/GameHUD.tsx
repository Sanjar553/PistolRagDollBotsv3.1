import React, { useState } from 'react';
import { GameSettings, HitRecord, WeaponType } from '../types';
import { WEAPON_CONFIGS } from '../scene/proceduralGun';
import {
  Volume2,
  VolumeX,
  Eye,
  Crosshair,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Hand,
  MousePointer,
  Heart,
  Skull,
  Zap,
  Smartphone,
} from 'lucide-react';

interface GameHUDProps {
  currentWeapon: WeaponType;
  onSelectWeapon: (w: WeaponType) => void;
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  onReload: () => void;
  settings: GameSettings;
  onUpdateSettings: (s: Partial<GameSettings>) => void;
  onSpawnScenario: (sc: 'single' | 'triple' | 'ledge' | 'patrol' | 'horde') => void;
  onResetScene: () => void;
  hitRecord: HitRecord | null;
  isAiming: boolean;
  onToggleAim: () => void;
  isDragMode: boolean;
  onToggleDragMode: () => void;
  onTogglePointerLock?: () => void;
  aliveCount: number;
  ragdollCount: number;
  playerHealth: number;
  maxPlayerHealth: number;
  kills: number;
  hurtFlash: boolean;
  onRespawn: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  currentWeapon,
  onSelectWeapon,
  currentAmmo,
  maxAmmo,
  isReloading,
  onReload,
  settings,
  onUpdateSettings,
  onSpawnScenario,
  onResetScene,
  hitRecord,
  isAiming,
  onToggleAim,
  isDragMode,
  onToggleDragMode,
  onTogglePointerLock,
  aliveCount,
  ragdollCount,
  playerHealth,
  maxPlayerHealth,
  kills,
  hurtFlash,
  onRespawn,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<'weapons' | 'simulation' | 'scenarios'>('weapons');

  const isUz = settings.language === 'uz';
  const isDead = playerHealth <= 0;

  const zoneNamesUz: Record<string, string> = {
    head: 'BOSHGA TEGDI! (HEADSHOT)',
    neck: "BO'YINGA ZARBA",
    chest: "KO'KRAKKA ZARBA (TORSO)",
    spine: 'QORINGA ZARBA',
    pelvis: 'BEL/TOZ ZARBAsi',
    left_arm: "CHAP QO'LGA TEGDI",
    right_arm: "O'NG QO'LGA TEGDI",
    left_leg: 'CHAP OYOQ SINDI',
    right_leg: "O'NG OYOQ SINDI",
  };

  const zoneNamesEn: Record<string, string> = {
    head: 'HEADSHOT! (CRITICAL)',
    neck: 'NECK IMPACT',
    chest: 'TORSO IMPACT',
    spine: 'ABDOMEN HIT',
    pelvis: 'PELVIS HIT',
    left_arm: 'LEFT ARM HIT',
    right_arm: 'RIGHT ARM HIT',
    left_leg: 'LEFT LEG HIT',
    right_leg: 'RIGHT LEG HIT',
  };

  const healthPercent = Math.max(0, Math.min(100, (playerHealth / maxPlayerHealth) * 100));

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans text-neutral-100">
      {/* Red hurt screen vignette when punched by bot */}
      {hurtFlash && (
        <div className="absolute inset-0 pointer-events-none bg-red-600/25 shadow-[inset_0_0_120px_rgba(239,68,68,0.85)] z-20 transition-opacity duration-150 animate-pulse" />
      )}

      {/* Responsive Top Bar */}
      <div
        className="absolute top-2 sm:top-4 inset-x-2 sm:inset-x-6 flex flex-wrap items-center justify-between gap-2 z-20"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Left Side: Status & Counts */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="bg-neutral-900/95 border border-neutral-700/80 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 sm:gap-2 shadow-lg backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[11px] sm:text-xs tracking-wider uppercase text-neutral-300 hidden md:inline">
              {isUz ? 'Ragdoll Arenasi' : 'Combat Arena'}
            </span>
            <span className="text-neutral-500 hidden md:inline">|</span>
            <span className="text-[10px] sm:text-xs text-neutral-300 font-mono tabular-nums">
              {aliveCount} {isUz ? 'Bot' : 'Bots'} &bull; {ragdollCount} {isUz ? 'Qulagan' : 'Down'}
            </span>
          </div>

          {/* Kills Counter */}
          <div className="bg-neutral-900/95 border border-neutral-700/80 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
            <Skull className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] sm:text-xs font-mono font-bold text-neutral-200 tabular-nums">
              {kills} <span className="hidden sm:inline">{isUz ? "O'ldirildi" : 'Kills'}</span>
            </span>
          </div>
        </div>

        {/* Center: Health Bar */}
        <div className="bg-neutral-900/95 border border-neutral-700/90 px-3 sm:px-4 py-1 sm:py-1.5 rounded-xl flex items-center gap-2 sm:gap-3 shadow-xl backdrop-blur-sm order-last sm:order-none mx-auto sm:mx-0">
          <div className="flex items-center gap-1.5">
            <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${playerHealth <= 30 ? 'text-red-500 animate-ping' : 'text-red-400'}`} />
            <span className="text-[11px] sm:text-xs font-mono font-bold tabular-nums">
              {Math.max(0, playerHealth)} <span className="text-neutral-500 text-[9px] sm:text-[10px]">HP</span>
            </span>
          </div>

          <div className="w-20 sm:w-28 h-2 sm:h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
            <div
              className={`h-full transition-all duration-200 ${
                healthPercent > 50
                  ? 'bg-emerald-500'
                  : healthPercent > 25
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>

        {/* Right Side: Quick Action Buttons (Touch Toggle, Sound, Language, Autospawn) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Touch Controls Toggle */}
          <button
            onClick={() => onUpdateSettings({ touchControls: !settings.touchControls })}
            className={`pointer-events-auto flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-bold transition-all shadow-lg cursor-pointer ${
              settings.touchControls
                ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                : 'bg-neutral-900/95 hover:bg-neutral-800 border-neutral-700/80 text-neutral-400'
            }`}
            title={isUz ? "Telefon uchun tugmalar (Touch controls)" : "Mobile Touch Controls"}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isUz ? 'Sensor' : 'Touch'}</span>
          </button>

          {/* Autospawn Quick Toggle */}
          <button
            onClick={() => onUpdateSettings({ autoSpawn: !settings.autoSpawn })}
            className={`pointer-events-auto hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-lg cursor-pointer ${
              settings.autoSpawn
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 text-neutral-400'
            }`}
            title={isUz ? "Botlarning tinimsiz paydo bo'lishi" : "Continuous enemy waves"}
          >
            <Zap className="w-3 h-3" />
            <span>AUTO</span>
          </button>

          {/* Quick Language Toggle */}
          <button
            onClick={() => onUpdateSettings({ language: isUz ? 'en' : 'uz' })}
            className="pointer-events-auto bg-neutral-900/95 hover:bg-neutral-800 border border-neutral-700/80 px-2 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Switch language / Tilni o'zgartirish"
          >
            {isUz ? 'UZ' : 'EN'}
          </button>

          {/* Sound toggle */}
          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className="pointer-events-auto bg-neutral-900/95 hover:bg-neutral-800 border border-neutral-700/80 p-1.5 sm:p-2 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title={isUz ? "Ovozni yoqish/o'chirish" : 'Toggle sound'}
          >
            {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
          </button>
        </div>
      </div>

      {/* Hit Confirmation Feedback Banner */}
      {hitRecord && (
        <div
          key={hitRecord.timestamp}
          className={`absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border font-mono tracking-wide text-[11px] sm:text-xs font-bold uppercase animate-fade-in shadow-xl z-20 ${
            hitRecord.zone === 'head'
              ? 'bg-red-950/90 border-red-500/80 text-red-200'
              : 'bg-neutral-900/90 border-amber-500/80 text-amber-200'
          }`}
        >
          <Crosshair className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${hitRecord.zone === 'head' ? 'text-red-400' : 'text-amber-400'}`} />
          <span>{isUz ? zoneNamesUz[hitRecord.zone] || hitRecord.zone : zoneNamesEn[hitRecord.zone] || hitRecord.zone}</span>
          <span className="text-neutral-400 text-[9px] sm:text-[10px]">
            {hitRecord.isFatal ? (isUz ? "[O'LIMLI RAGDOLL]" : '[FATAL RAGDOLL]') : (isUz ? '[ZARBA]' : '[STAGGER]')}
          </span>
        </div>
      )}

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className={`transition-all duration-75 relative ${isAiming ? 'opacity-15 scale-75' : 'opacity-85'}`}>
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-neutral-200/80" />
          <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-[1.5px] h-2 bg-neutral-200/80" />
          <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-2 h-[1.5px] bg-neutral-200/80" />
          <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-2 h-[1.5px] bg-neutral-200/80" />
        </div>

        {/* Dynamic Hitmarker Ticks */}
        {hitRecord && (
          <div className="absolute pointer-events-none w-7 h-7">
            <div className={`absolute top-0 left-0 w-2 h-0.5 rotate-45 origin-left ${hitRecord.zone === 'head' ? 'bg-red-500' : 'bg-amber-300'}`} />
            <div className={`absolute top-0 right-0 w-2 h-0.5 -rotate-45 origin-right ${hitRecord.zone === 'head' ? 'bg-red-500' : 'bg-amber-300'}`} />
            <div className={`absolute bottom-0 left-0 w-2 h-0.5 -rotate-45 origin-left ${hitRecord.zone === 'head' ? 'bg-red-500' : 'bg-amber-300'}`} />
            <div className={`absolute bottom-0 right-0 w-2 h-0.5 rotate-45 origin-right ${hitRecord.zone === 'head' ? 'bg-red-500' : 'bg-amber-300'}`} />
          </div>
        )}
      </div>

      {/* Floating Action Cluster (Desktop Mode Only) */}
      {!settings.touchControls && (
        <div
          className="absolute bottom-24 right-6 flex flex-col items-end gap-2.5 pointer-events-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Aim ADS toggle button */}
          <button
            onClick={onToggleAim}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors shadow-lg cursor-pointer ${
              isAiming
                ? 'bg-amber-500/20 border-amber-500/80 text-amber-200'
                : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
            }`}
            title="Right-click also aims"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isUz ? (isAiming ? 'Nishon (Faol)' : 'Nishonga olish') : isAiming ? 'Aiming' : 'Aim ADS'}</span>
          </button>

          {/* Drag Ragdoll Toggle button */}
          <button
            onClick={onToggleDragMode}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors shadow-lg cursor-pointer ${
              isDragMode
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/30'
                : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300'
            }`}
            title={isUz ? "Tushgan odamni sichqoncha bilan ushlab otish va tortish" : 'Click & drag ragdoll joints'}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>
              {isUz
                ? isDragMode
                  ? 'Ragdoll Tortish: FAOL'
                  : 'Ragdollni Tortish'
                : isDragMode
                ? 'Drag Ragdoll: ACTIVE'
                : 'Drag Ragdoll'}
            </span>
          </button>

          {/* Pointer Lock (FPS View) toggle button */}
          {onTogglePointerLock && (
            <button
              onClick={onTogglePointerLock}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border bg-neutral-900/90 hover:bg-neutral-800 border-neutral-700/80 text-neutral-300 transition-colors shadow-lg cursor-pointer"
              title={isUz ? "Kamera qulflash: sichqoncha bilan erkin qarash (FPS)" : 'Toggle FPS pointer lock'}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>{isUz ? "FPS Ko'rinish" : 'FPS View'}</span>
            </button>
          )}

          {/* Ammo & Reload Display */}
          <div className="bg-neutral-900/95 border border-neutral-700/90 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                {WEAPON_CONFIGS[currentWeapon]?.[isUz ? 'nameUz' : 'name']}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-mono font-bold tabular-nums ${currentAmmo <= 5 ? 'text-red-400' : 'text-neutral-100'}`}>
                  {isReloading ? '--' : currentAmmo}
                </span>
                <span className="text-xs font-mono text-neutral-500 tabular-nums">/ {maxAmmo}</span>
              </div>
            </div>

            <button
              onClick={onReload}
              disabled={isReloading || currentAmmo === maxAmmo}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                isReloading
                  ? 'bg-amber-900/40 border-amber-700 text-amber-300 animate-pulse'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-200'
              }`}
            >
              {isReloading ? (isUz ? "O'qlanmoqda..." : 'Reloading...') : isUz ? "O'qlash (R)" : 'Reload (R)'}
            </button>
          </div>
        </div>
      )}

      {/* Ergonomic Collapsible Bottom Dock (Center bottom, collapsible) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-full max-w-[880px] px-2 sm:px-4 pointer-events-auto transition-transform duration-300 z-20 ${
          isDockCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
        }`}
      >
        <div className="bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Header Bar with Tabs and Collapse Toggle */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-neutral-800 bg-neutral-950/80">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
              <button
                onClick={() => {
                  setActiveTab('weapons');
                  setIsDockCollapsed(false);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'weapons'
                    ? 'bg-neutral-800 text-white border border-neutral-600'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isUz ? 'Qurollar' : 'Weapons'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('simulation');
                  setIsDockCollapsed(false);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'simulation'
                    ? 'bg-neutral-800 text-white border border-neutral-600'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isUz ? 'Fizika & Tezlik' : 'Physics'}
              </button>
              <button
                onClick={() => {
                  setActiveTab('scenarios');
                  setIsDockCollapsed(false);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'scenarios'
                    ? 'bg-neutral-800 text-white border border-neutral-600'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isUz ? 'Hujum Ssenariylari' : 'Scenarios'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={onResetScene}
                className="flex items-center gap-1 text-[11px] sm:text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isUz ? "Barcha nishonlarni tozalash" : 'Reset all dummies'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{isUz ? 'Tozalash' : 'Clear'}</span>
              </button>

              <button
                onClick={() => setIsDockCollapsed(!isDockCollapsed)}
                className="p-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title={isDockCollapsed ? 'Expand Dock' : 'Collapse Dock'}
              >
                <span className="text-[10px] uppercase text-neutral-400 font-mono hidden sm:inline">
                  {isDockCollapsed ? (isUz ? 'Menyu' : 'Menu') : (isUz ? 'Yopish' : 'Close')}
                </span>
                {isDockCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          <div className="p-3">
            {activeTab === 'weapons' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                {(Object.keys(WEAPON_CONFIGS) as WeaponType[]).map((wId) => {
                  const w = WEAPON_CONFIGS[wId];
                  const isSelected = currentWeapon === wId;
                  const isAk = wId === 'ak47';
                  return (
                    <button
                      key={wId}
                      onClick={() => onSelectWeapon(wId)}
                      className={`flex flex-col items-start p-2 rounded-xl border transition-all text-left cursor-pointer ${
                        isSelected
                          ? isAk
                            ? 'bg-amber-950/60 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                            : 'bg-neutral-800 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                          : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-xs text-neutral-200">
                          {isUz ? w.nameUz : w.name}
                        </span>
                        {isAk && (
                          <span className="px-1 py-0.5 text-[8px] bg-amber-500 text-neutral-950 font-bold rounded">
                            AVTOMAT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 mt-0.5">{w.caliber}</span>
                      <div className="flex items-center gap-1.5 mt-1.5 w-full text-[9px] text-neutral-400 font-mono">
                        <span>{isUz ? 'Kuch' : 'Pwr'}: {w.impulseForce}N</span>
                        <span>•</span>
                        <span>{isUz ? 'Sig' : 'Cap'}: {w.magazineSize}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'simulation' && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Time Scale Multipliers */}
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">{isUz ? 'Tezlik:' : 'Speed:'}</span>
                  <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                    {[
                      { label: '1.0x', val: 1.0 },
                      { label: '0.25x', val: 0.25 },
                      { label: '0.05x Slow', val: 0.05 },
                    ].map((t) => (
                      <button
                        key={t.val}
                        onClick={() => onUpdateSettings({ timeScale: t.val })}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                          settings.timeScale === t.val
                            ? 'bg-amber-600 text-white'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Autospawn Toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.autoSpawn}
                    onChange={(e) => onUpdateSettings({ autoSpawn: e.target.checked })}
                    className="rounded bg-neutral-950 border-neutral-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="font-semibold text-emerald-400 text-xs">
                    {isUz ? 'Doimiy Botlar (Autospawn)' : 'Continuous Autospawn'}
                  </span>
                </label>

                {/* Bullet time on lethal hit */}
                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.bulletTimeOnKill}
                    onChange={(e) => onUpdateSettings({ bulletTimeOnKill: e.target.checked })}
                    className="rounded bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs">{isUz ? "O'limda sekinlashtirish" : 'Slow-mo on kill'}</span>
                </label>

                {/* Laser Sight */}
                <label className="flex items-center gap-1.5 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={settings.laserPointer}
                    onChange={(e) => onUpdateSettings({ laserPointer: e.target.checked })}
                    className="rounded bg-neutral-950 border-neutral-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs">{isUz ? 'Lazer' : 'Laser'}</span>
                </label>
              </div>
            )}

            {activeTab === 'scenarios' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => onSpawnScenario('single')}
                  className="p-2 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-neutral-200 block">
                    {isUz ? '1 Ta Hujumchi Bot' : 'Single Attacker'}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {isUz ? 'Yugurib kelib uradi' : 'Runs and punches'}
                  </span>
                </button>

                <button
                  onClick={() => onSpawnScenario('triple')}
                  className="p-2 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-neutral-200 block">
                    {isUz ? '3 Ta Hujumchi Bot' : '3 Attackers'}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {isUz ? 'Uchtasi hujum qiladi' : 'Assault squad'}
                  </span>
                </button>

                <button
                  onClick={() => onSpawnScenario('horde')}
                  className="p-2 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-red-300 block">
                    {isUz ? 'Botlar Oqimi (6 Bot)' : 'Bot Horde (6 Bots)'}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {isUz ? "6 ta bot o'rab oladi" : '6 bots attack'}
                  </span>
                </button>

                <button
                  onClick={() => onSpawnScenario('patrol')}
                  className="p-2 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-xl text-left cursor-pointer transition-colors"
                >
                  <span className="text-xs font-semibold text-neutral-200 block">
                    {isUz ? 'Qurshov Mashqi' : 'Flank Assault'}
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {isUz ? 'Ikki qanotdan chopadi' : 'Flankers'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Over / Player Defeat Modal */}
      {isDead && (
        <div
          className="absolute inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4 select-none"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="bg-neutral-900 border border-red-500/60 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border border-red-500/80 text-red-400 flex items-center justify-center mx-auto mb-4">
              <Skull className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black text-white uppercase tracking-wide mb-2">
              {isUz ? 'Siz Yiqildingiz!' : 'You Were Defeated!'}
            </h2>
            <p className="text-sm text-neutral-300 mb-6">
              {isUz
                ? `Botlar sizni urib yengishdi. Jami ${kills} ta botni yo'q qildingiz!`
                : `The bots overwhelmed and punched you down. You eliminated ${kills} bots!`}
            </p>

            <button
              onClick={onRespawn}
              className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 transition-all cursor-pointer text-sm uppercase tracking-wider active:scale-95"
            >
              {isUz ? 'Qayta Jang Boshlash' : 'Respawn & Fight Again'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
