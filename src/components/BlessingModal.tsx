import { useState, type FormEvent } from 'react';
import { Check, Link2, RotateCcw, X } from 'lucide-react';
import {
  buildShareUrl,
  DEFAULT_GREETING,
  GREETING_PRESETS,
  type GreetingConfig,
} from '../types/festival';

interface BlessingModalProps {
  open: boolean;
  greeting: GreetingConfig;
  onClose: () => void;
  onSave: (next: GreetingConfig, previewFinale: boolean) => void;
}

export function BlessingModal({ open, greeting, onClose, onSave }: BlessingModalProps) {
  const [draft, setDraft] = useState<GreetingConfig>(greeting);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(
      {
        recipient: draft.recipient.trim(),
        headline: draft.headline.trim() || DEFAULT_GREETING.headline,
        subline: draft.subline.trim(),
        signature: draft.signature.trim(),
      },
      true,
    );
    onClose();
  };

  const handleCopyShareLink = async () => {
    const cleaned: GreetingConfig = {
      recipient: draft.recipient.trim() || DEFAULT_GREETING.recipient,
      headline: draft.headline.trim() || DEFAULT_GREETING.headline,
      subline: draft.subline.trim() || DEFAULT_GREETING.subline,
      signature: draft.signature.trim() || DEFAULT_GREETING.signature,
    };
    onSave(cleaned, false);
    const shareUrl = buildShareUrl(cleaned);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback copy via temporary input if clipboard API is restricted
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blessing-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#E8B85A]/28 bg-[#0B0D18] p-6 text-[#F6EFE2] shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2
              id="blessing-modal-title"
              className="poetic-headline text-xl font-semibold tracking-[0.1em] text-[#FFF8EB]"
            >
              定制第四幕专属贺岁祝福
            </h2>
            <p className="mt-1 text-xs text-[#B4A99A]">
              保存后将立即预览定格落款，也可复制专属链接分享给亲友。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭窗口"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#B4A99A] transition-colors hover:bg-white/8 hover:text-[#FFF8EB] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preset Quick Selector */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#B4A99A] mr-1">快捷文案灵感：</span>
          {GREETING_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDraft({ ...preset.config })}
              className="rounded-md border border-[#E8B85A]/22 bg-[#141727] px-2.5 py-1 text-xs text-[#E3D7C4] transition-colors hover:border-[#E8B85A]/55 hover:text-[#FFF8EB] whitespace-nowrap cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="greeting-recipient" className="block text-xs text-[#D8CBB8] mb-1.5">
                致赠对象
              </label>
              <input
                id="greeting-recipient"
                type="text"
                maxLength={24}
                value={draft.recipient}
                onChange={(e) => setDraft({ ...draft, recipient: e.target.value })}
                placeholder="例如：挚友与家人"
                className="w-full rounded-lg border border-white/14 bg-[#121626] px-3 py-2 text-sm text-[#FFF8EB] placeholder-[#7B746A] focus:border-[#E8B85A] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="greeting-signature" className="block text-xs text-[#D8CBB8] mb-1.5">
                落款署名
              </label>
              <input
                id="greeting-signature"
                type="text"
                maxLength={24}
                value={draft.signature}
                onChange={(e) => setDraft({ ...draft, signature: e.target.value })}
                placeholder="例如：你的名字"
                className="w-full rounded-lg border border-white/14 bg-[#121626] px-3 py-2 text-sm text-[#FFF8EB] placeholder-[#7B746A] focus:border-[#E8B85A] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="greeting-headline" className="block text-xs text-[#D8CBB8] mb-1.5">
              主祝福语
            </label>
            <input
              id="greeting-headline"
              type="text"
              maxLength={32}
              required
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="岁岁常欢愉，年年皆胜意"
              className="w-full rounded-lg border border-white/14 bg-[#121626] px-3 py-2 text-sm text-[#FFF8EB] placeholder-[#7B746A] focus:border-[#E8B85A] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="greeting-subline" className="block text-xs text-[#D8CBB8] mb-1.5">
              诗意副句
            </label>
            <textarea
              id="greeting-subline"
              rows={2}
              maxLength={56}
              value={draft.subline}
              onChange={(e) => setDraft({ ...draft, subline: e.target.value })}
              placeholder="愿这一夜流光与烟火，伴你奔赴明朗新岁"
              className="w-full resize-none rounded-lg border border-white/14 bg-[#121626] px-3 py-2 text-sm text-[#FFF8EB] placeholder-[#7B746A] focus:border-[#E8B85A] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...DEFAULT_GREETING })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141727] px-3 py-2 text-xs text-[#D8CBB8] transition-colors hover:border-white/25 hover:text-[#FFF8EB] whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>恢复默认</span>
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8B85A]/35 bg-[#1B1813] px-3 py-2 text-xs text-[#F5D388] transition-colors hover:border-[#E8B85A]/65 whitespace-nowrap cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#F5D388]" /> : <Link2 className="h-3.5 w-3.5" />}
                <span>{copied ? '专属链接已复制' : '复制分享链接'}</span>
              </button>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-[#C82829] px-5 py-2 text-xs font-medium text-[#FFF8EB] transition-colors hover:bg-[#DC3233] focus-visible:outline-2 focus-visible:outline-[#E8B85A] whitespace-nowrap cursor-pointer"
            >
              保存并预览定格
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
