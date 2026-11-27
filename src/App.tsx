import { useCallback, useEffect, useRef, useState } from 'react';
import { FestiveAudioEngine } from './audio/festiveAudio';
import { BlessingModal } from './components/BlessingModal';
import { ControlDock } from './components/ControlDock';
import { PoeticOverlay } from './components/PoeticOverlay';
import { FestiveSceneController } from './scene/festiveScene';
import {
  loadInitialGreeting,
  saveGreeting,
  type EngineTelemetry,
  type GreetingConfig,
} from './types/festival';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<FestiveSceneController | null>(null);
  const audioRef = useRef<FestiveAudioEngine | null>(null);

  const [telemetry, setTelemetry] = useState<EngineTelemetry>({
    currentTime: 0,
    activeAct: 1,
    isPlaying: true,
    cameraMode: 'cinematic',
    contextLost: false,
  });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [showSubtitlesInPureMode, setShowSubtitlesInPureMode] = useState(true);
  const [blessingModalOpen, setBlessingModalOpen] = useState(false);
  const [greeting, setGreeting] = useState<GreetingConfig>(() => loadInitialGreeting());

  // Initialize isolated Three.js engine & procedural Web Audio engine once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const audio = new FestiveAudioEngine();
    audioRef.current = audio;

    const controller = new FestiveSceneController(mountEl, {
      onTelemetry: (next) => {
        setTelemetry(next);
      },
      onActChange: (act) => {
        audio.setAct(act);
      },
      onFireworkLaunch: () => {
        audio.playLaunch();
      },
      onFireworkBurst: (style, intensity) => {
        audio.playBurst(style, intensity);
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  // Keyboard shortcuts: H = pure mode, Space = play/pause, F = launch firework
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (blessingModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setHudHidden((prev) => !prev);
      } else if (e.code === 'Space') {
        e.preventDefault();
        controllerRef.current?.togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        controllerRef.current?.launchCelebrationSalvo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [blessingModalOpen]);

  const handleTogglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const handleReplay = useCallback(() => {
    controllerRef.current?.replay();
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    controllerRef.current?.seek(seconds);
  }, []);

  const handleLaunchFirework = useCallback(() => {
    controllerRef.current?.launchCelebrationSalvo();
  }, []);

  const handleToggleCameraMode = useCallback(() => {
    const next = telemetry.cameraMode === 'cinematic' ? 'free' : 'cinematic';
    controllerRef.current?.setCameraMode(next);
  }, [telemetry.cameraMode]);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      audioRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const handleSaveGreeting = useCallback((next: GreetingConfig, previewFinale: boolean) => {
    setGreeting(next);
    saveGreeting(next);
    if (previewFinale) {
      controllerRef.current?.setCameraMode('cinematic');
      controllerRef.current?.seek(49.2);
      controllerRef.current?.setPlaying(true);
      controllerRef.current?.launchCelebrationSalvo();
    }
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#070914] select-none">
      {/* Isolated WebGL Canvas Mount Container (never re-created by React HUD state updates) */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Graceful WebGL Context-Lost Fallback */}
      {telemetry.contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#070914]/95 p-6">
          <div className="max-w-md rounded-2xl border border-[#E8B85A]/30 bg-[#0D1020] p-6 text-center">
            <h2 className="poetic-headline text-xl font-semibold text-[#FFF8EB]">
              3D 渲染画面已暂停
            </h2>
            <p className="mt-2 text-sm text-[#B4A99A]">
              浏览器图形上下文临时中断，点击下方按钮即可重新点亮新春祈愿树。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-[#C82829] px-5 py-2 text-sm font-medium text-[#FFF8EB] transition-colors hover:bg-[#DC3233] cursor-pointer"
            >
              重新加载场景
            </button>
          </div>
        </div>
      )}

      {/* Semantic DOM Poetic Header & Subtitle Stage */}
      <PoeticOverlay
        activeAct={telemetry.activeAct}
        currentTime={telemetry.currentTime}
        greeting={greeting}
        hudHidden={hudHidden}
        showSubtitlesInPureMode={showSubtitlesInPureMode}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      <ControlDock
        currentTime={telemetry.currentTime}
        activeAct={telemetry.activeAct}
        isPlaying={telemetry.isPlaying}
        cameraMode={telemetry.cameraMode}
        audioEnabled={audioEnabled}
        hudHidden={hudHidden}
        showSubtitlesInPureMode={showSubtitlesInPureMode}
        onTogglePlay={handleTogglePlay}
        onReplay={handleReplay}
        onSeek={handleSeek}
        onLaunchFirework={handleLaunchFirework}
        onToggleCameraMode={handleToggleCameraMode}
        onToggleAudio={handleToggleAudio}
        onOpenBlessingModal={() => setBlessingModalOpen(true)}
        onToggleHudHidden={() => setHudHidden((prev) => !prev)}
        onToggleSubtitlesInPureMode={() => setShowSubtitlesInPureMode((prev) => !prev)}
      />

      {/* Custom Greeting & Shareable Link Modal */}
      <BlessingModal
        key={blessingModalOpen ? 'open' : 'closed'}
        open={blessingModalOpen}
        greeting={greeting}
        onClose={() => setBlessingModalOpen(false)}
        onSave={handleSaveGreeting}
      />
    </main>
  );
}
