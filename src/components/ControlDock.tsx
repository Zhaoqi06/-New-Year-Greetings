import {
  ChevronDown,
  ChevronUp,
  Compass,
  PenLine,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Subtitles,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACTS,
  formatTimecode,
  SHOW_DURATION,
  type ActId,
  type CameraMode,
} from '../types/festival';

interface ControlDockProps {
  currentTime: number;
  activeAct: ActId;
  isPlaying: boolean;
  cameraMode: CameraMode;
  audioEnabled: boolean;
  hudHidden: boolean;
  showSubtitlesInPureMode: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
  onSeek: (seconds: number) => void;
  onLaunchFirework: () => void;
  onToggleCameraMode: () => void;
  onToggleAudio: () => void;
  onOpenBlessingModal: () => void;
  onToggleHudHidden: () => void;
  onToggleSubtitlesInPureMode: () => void;
}

export function ControlDock({
  currentTime,
  activeAct,
  isPlaying,
  cameraMode,
  audioEnabled,
  hudHidden,
  showSubtitlesInPureMode,
  onTogglePlay,
  onReplay,
  onSeek,
  onLaunchFirework,
  onToggleCameraMode,
  onToggleAudio,
  onOpenBlessingModal,
  onToggleHudHidden,
  onToggleSubtitlesInPureMode,
}: ControlDockProps) {
  const progressPct = Math.min(100, Math.max(0, (currentTime / SHOW_DURATION) * 100));

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 flex w-[min(940px,94vw)] -translate-x-1/2 flex-col items-center">
      {/* Slim Collapse / Pure Recording Mode Toggle Tab */}
      <div className="pointer-events-auto mb-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleHudHidden}
          title="隐藏或展开控制栏（快捷键 H）"
          className="inline-flex items-center gap-1.5 rounded-t-lg rounded-b-md border border-[#E8B85A]/25 bg-[#0A0C16]/90 px-3 py-1 text-xs text-[#D8CBB8] transition-colors hover:border-[#E8B85A]/50 hover:text-[#FFF8EB] focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hudHidden ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-[#E8B85A]" />
              <span>展开控制栏</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-[#E8B85A]" />
              <span>纯净观赏</span>
            </>
          )}
        </button>

        {hudHidden && (
          <button
            type="button"
            onClick={onToggleSubtitlesInPureMode}
            title="纯净模式下切换是否显示贺岁字幕"
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E8B85A]/25 bg-[#0A0C16]/90 px-3 py-1 text-xs text-[#D8CBB8] transition-colors hover:border-[#E8B85A]/50 hover:text-[#FFF8EB] focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Subtitles className="h-3.5 w-3.5 text-[#E8B85A]" />
            <span>{showSubtitlesInPureMode ? '隐藏字幕' : '显示字幕'}</span>
          </button>
        )}
      </div>

      {/* Unified Horizontal Bottom Control Dock (Solid rgba surface, ZERO backdrop-filter over WebGL) */}
      <div
        className={`pointer-events-auto w-full rounded-xl border border-[#E8B85A]/22 bg-[#0A0C16]/92 px-3.5 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all duration-300 ${
          hudHidden
            ? 'pointer-events-none translate-y-[140%] opacity-0'
            : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Row 1: 60s Four-Act Timeline Scrubber & Act Jump Markers */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? '暂停演绎' : '继续演绎'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#C82829] text-[#FFF8EB] transition-colors hover:bg-[#DC3233] focus-visible:outline-2 focus-visible:outline-[#E8B85A] cursor-pointer"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onReplay}
              aria-label="从头重播"
              title="从第一幕重播"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141727] text-[#D8CBB8] transition-colors hover:border-[#E8B85A]/40 hover:text-[#FFF8EB] focus-visible:outline-2 focus-visible:outline-[#E8B85A] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrubber Bar */}
          <div className="relative flex flex-1 flex-col justify-center">
            <div className="relative flex h-5 items-center">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#C82829] via-[#E8983E] to-[#F5D388]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Act boundary ticks */}
              {ACTS.slice(1).map((act) => (
                <span
                  key={act.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[#E8B85A]/45"
                  style={{ left: `${(act.startTime / SHOW_DURATION) * 100}%` }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={SHOW_DURATION - 0.1}
                step={0.1}
                value={currentTime}
                aria-label="60 秒四幕演绎进度"
                onChange={(e) => onSeek(Number(e.target.value))}
                className="festival-scrubber absolute inset-0 h-full w-full"
              />
            </div>
          </div>

          {/* Tabular Timecode */}
          <div className="shrink-0 text-xs font-medium tracking-wider text-[#D8CBB8] tabular-nums whitespace-nowrap">
            <span>{formatTimecode(currentTime)}</span>
            <span className="mx-1 text-[#B4A99A]/50">/</span>
            <span className="text-[#B4A99A]">01:00</span>
          </div>
        </div>

        {/* Row 2: Four Act Quick Selectors + Interactive Controls */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2">
          {/* 4 Act Segmented Tabs */}
          <div className="flex items-center gap-1" role="tablist" aria-label="四幕章节跳转">
            {ACTS.map((act) => {
              const isActive = act.id === activeAct;
              return (
                <button
                  key={act.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSeek(act.startTime + 0.05)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E8B85A] ${
                    isActive
                      ? 'bg-[#E8B85A]/18 text-[#F5D388] font-medium'
                      : 'text-[#B4A99A] hover:bg-white/6 hover:text-[#F6EFE2]'
                  }`}
                >
                  {act.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onLaunchFirework}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8B85A]/45 bg-[#2A1718] px-3 py-1.5 text-xs font-medium text-[#FFE6B0] transition-colors hover:bg-[#3A1E20] focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#F5D388]" />
              <span>放烟花</span>
            </button>

            <button
              type="button"
              onClick={onToggleCameraMode}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer ${
                cameraMode === 'cinematic'
                  ? 'border-[#E8B85A]/35 bg-[#191D30] text-[#F6EFE2]'
                  : 'border-white/12 bg-[#141727] text-[#D8CBB8] hover:border-[#E8B85A]/35 hover:text-[#F6EFE2]'
              }`}
            >
              {cameraMode === 'cinematic' ? (
                <>
                  <Video className="h-3.5 w-3.5 text-[#E8B85A]" />
                  <span>自动运镜</span>
                </>
              ) : (
                <>
                  <Compass className="h-3.5 w-3.5 text-[#E8B85A]" />
                  <span>回到运镜</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleAudio}
              aria-pressed={audioEnabled}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer ${
                audioEnabled
                  ? 'border-[#E8B85A]/45 bg-[#221F18] text-[#F5D388]'
                  : 'border-white/12 bg-[#141727] text-[#D8CBB8] hover:border-[#E8B85A]/35 hover:text-[#F6EFE2]'
              }`}
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-[#E8B85A]" />
                  <span>音效开</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-[#B4A99A]" />
                  <span>开启音效</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenBlessingModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141727] px-2.5 py-1.5 text-xs text-[#F6EFE2] transition-colors hover:border-[#E8B85A]/45 hover:bg-[#1B1F33] focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PenLine className="h-3.5 w-3.5 text-[#E8B85A]" />
              <span>定制祝福</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
