import { ACTS, type ActId, type GreetingConfig } from '../types/festival';

interface PoeticOverlayProps {
  activeAct: ActId;
  currentTime: number;
  greeting: GreetingConfig;
  hudHidden: boolean;
  showSubtitlesInPureMode: boolean;
}

export function PoeticOverlay({
  activeAct,
  currentTime,
  greeting,
  hudHidden,
  showSubtitlesInPureMode,
}: PoeticOverlayProps) {
  const act = ACTS.find((item) => item.id === activeAct) ?? ACTS[0];
  const isFinale = activeAct === 4;

  // Soft fade in/out near the boundaries of each act for cinematic subtitle pacing
  const timeInAct = currentTime - act.startTime;
  const actDuration = act.endTime - act.startTime;
  const fadeIn = Math.min(1, Math.max(0, (timeInAct - 0.5) / 1.4));
  const fadeOut = isFinale
    ? Math.min(1, Math.max(0, (actDuration - timeInAct) / 1.0))
    : Math.min(1, Math.max(0, (actDuration - timeInAct - 0.35) / 1.1));
  const subtitleOpacity = Math.min(fadeIn, fadeOut);

  const shouldRenderSubtitles = !hudHidden || showSubtitlesInPureMode;

  return (
    <>
      {/* Top-Left Minimal Unboxed Editorial Header (Zero Pills, Zero Pulsing Dots) */}
      <header
        className={`pointer-events-none fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-5 sm:px-8 transition-opacity duration-300 ${
          hudHidden ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex items-baseline gap-3 text-[#F6EFE2]">
          <h1 className="poetic-headline text-lg sm:text-xl font-semibold tracking-[0.16em] whitespace-nowrap">
            岁华映彩
          </h1>
          <span aria-hidden="true" className="text-[#E8B85A]/55 text-sm">
            ·
          </span>
          <span className="text-xs sm:text-sm tracking-[0.12em] text-[#D8CBB8] whitespace-nowrap">
            {act.chapterLabel}
          </span>
        </div>

        <p className="hidden md:block text-xs tracking-[0.08em] text-[#B4A99A] whitespace-nowrap">
          轻点夜空燃放礼花 · 拖拽画面自由赏景
        </p>
      </header>

      {/* Bottom Scrim & Poetic Subtitle / Act IV Personalized Blessing Stage */}
      {shouldRenderSubtitles && (
        <div
          aria-live="polite"
          className={`pointer-events-none fixed left-0 right-0 z-10 flex flex-col items-center justify-end px-6 text-center transition-all duration-300 ${
            hudHidden ? 'bottom-6' : 'bottom-[112px] sm:bottom-[104px]'
          }`}
        >
          {/* Measured soft scrim strictly behind text for >= 4.5:1 contrast during bright firework frames */}
          <div
            className="max-w-2xl rounded-xl px-6 py-4 transition-opacity duration-500"
            style={{
              opacity: subtitleOpacity,
              background:
                'radial-gradient(ellipse at center, rgba(7, 9, 20, 0.72) 0%, rgba(7, 9, 20, 0.42) 60%, rgba(7, 9, 20, 0) 100%)',
            }}
          >
            {isFinale ? (
              <div className="flex flex-col items-center gap-2.5">
                {greeting.recipient.trim() && (
                  <p className="text-xs sm:text-sm tracking-[0.22em] text-[#E8B85A] font-medium">
                    致 {greeting.recipient}
                  </p>
                )}
                <h2 className="poetic-headline text-2xl sm:text-4xl font-semibold tracking-[0.14em] text-[#FFF8EB] leading-snug">
                  {greeting.headline}
                </h2>
                {greeting.subline.trim() && (
                  <p className="text-sm sm:text-base tracking-[0.1em] text-[#E3D7C4] leading-relaxed">
                    {greeting.subline}
                  </p>
                )}
                {greeting.signature.trim() && (
                  <div className="mt-1 flex items-center gap-3 text-xs sm:text-sm tracking-[0.18em] text-[#E8B85A]/90">
                    <span className="inline-block h-px w-8 bg-[#E8B85A]/45" aria-hidden="true" />
                    <span className="font-serif">{greeting.signature}</span>
                    <span className="inline-block h-px w-8 bg-[#E8B85A]/45" aria-hidden="true" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="poetic-headline text-xl sm:text-3xl font-semibold tracking-[0.14em] text-[#FFF8EB] leading-snug">
                  {act.poeticPrimary}
                </p>
                <p className="text-xs sm:text-sm tracking-[0.12em] text-[#D8CBB8] leading-relaxed">
                  {act.poeticSecondary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
