import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard failed, fallback to execCommand', err);
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  }
}

export default function CopyPublicLinkButton({ type, id, isDark, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const url = `${window.location.origin}/?view=${type}&id=${id}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="複製免登入公開查閱網址"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-95 shrink-0 select-none ${
        copied
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
          : isDark
            ? 'bg-slate-800/90 text-stone-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200/80 hover:text-stone-900'
      } ${className}`}
    >
      {copied ? (
        <Check size={12} className="stroke-[2.5]" />
      ) : (
        <Share2 size={12} className="stroke-[2.2]" />
      )}
      <span>{copied ? '已複製網址' : '複製公開連結'}</span>
    </button>
  );
}
