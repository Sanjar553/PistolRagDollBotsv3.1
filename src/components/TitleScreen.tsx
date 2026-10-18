import React, { useEffect } from 'react';
import { Crosshair, Play, Smartphone } from 'lucide-react';

interface TitleScreenProps {
  onStartGame: () => void;
  language: 'uz' | 'en';
  onToggleLanguage: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  language,
  onToggleLanguage,
}) => {
  const isUz = language === 'uz';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between p-4 sm:p-8 md:p-12 bg-neutral-950/85 backdrop-brightness-50 select-none overflow-y-auto">
      {/* Top Header / Spec Badge */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <div className="font-mono text-[11px] sm:text-xs uppercase tracking-widest text-neutral-400">
              Verlet Ragdoll System v2.0
            </div>
            <div className="text-[10px] sm:text-xs text-neutral-500">Three.js 3D Physics Engine</div>
          </div>
        </div>

        {/* Language switch */}
        <button
          onClick={onToggleLanguage}
          className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-neutral-200 transition-colors cursor-pointer"
        >
          {isUz ? "O'zbekcha / EN" : 'English / UZ'}
        </button>
      </div>

      {/* Center Hero Lockup */}
      <div className="max-w-2xl my-auto py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/30 text-red-400 text-[11px] sm:text-xs font-mono uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {isUz ? 'Zarba va Ragdoll Fizikasi' : 'Ballistic Impact & Ragdoll Physics'}
        </div>

        {/* Bespoke inline SVG Title Lockup */}
        <div className="mb-4">
          <svg className="w-full max-w-sm sm:max-w-md h-12 sm:h-16" viewBox="0 0 520 64" fill="none">
            <text
              x="0"
              y="48"
              className="font-black text-4xl md:text-5xl tracking-tight fill-neutral-100 uppercase"
              style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 900 }}
            >
              PISTOL
            </text>
            <text
              x="165"
              y="48"
              className="font-black text-4xl md:text-5xl tracking-tight fill-amber-500 uppercase"
              style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 900 }}
            >
              RAGDOLL
            </text>
            <rect x="0" y="58" width="520" height="2" fill="url(#grad)" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="520" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f59e0b" />
                <stop offset="0.5" stopColor="#ef4444" />
                <stop offset="1" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <p className="text-neutral-300 text-xs sm:text-sm md:text-base leading-relaxed mb-6 max-w-lg">
          {isUz
            ? "To'pponcha va avtomat bilan otganda o'q tekkan qismiga (bosh, ko'krak, qo'l, oyoq) qarab dinamik fizikada reaksiyali ragdoll tizimi. Botlar yugurib kelib uradi! Telefon va kompyuter uchun to'liq moslangan."
            : 'Physics-based shooting simulation where targets react dynamically to exact bullet impact points with full Verlet joint ragdoll collapse. Bots run and punch! Fully mobile and desktop optimized.'}
        </p>

        {/* Mobile touch badge */}
        <div className="flex items-center gap-2 mb-6 text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-2 rounded-xl max-w-md">
          <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {isUz
              ? 'Mobil telefonlar uchun maxsus sensorli boshqaruv: virtual joystick, otish tugmasi va tezkor qurol almashtirish!'
              : 'Mobile-ready touch controls: virtual movement joystick, touch look, fire buttons and quick weapon bar!'}
          </span>
        </div>

        {/* Primary Start CTA Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button
            onClick={onStartGame}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black rounded-xl shadow-lg shadow-amber-500/25 text-base md:text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isUz ? 'O\'yinni Boshlash' : 'Start Simulation'}</span>
            <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs bg-amber-700/40 text-neutral-950 rounded font-mono font-normal">
              Enter / Space
            </kbd>
          </button>
        </div>
      </div>

      {/* Flat Single-Line Control Hint */}
      <div className="border-t border-neutral-800/80 pt-3 flex flex-wrap items-center justify-between text-[11px] sm:text-xs text-neutral-400 font-mono gap-2 mt-4">
        <div>
          {isUz
            ? 'Mobil: Joystick & Sensor tugmalar • PC: WASD, Sichqoncha, R, 1-5'
            : 'Mobile: Joystick & Touch buttons • PC: WASD, Mouse, R, 1-5'}
        </div>
        <div className="text-neutral-500">60 FPS Lossless Physics Simulation</div>
      </div>
    </div>
  );
};
