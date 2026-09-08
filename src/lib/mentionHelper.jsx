import React from 'react';

const STORAGE_KEY = 'wutps_read_mentions';

/**
 * 檢查文字中是否包含提及當前使用者 (@姓名 或 @名)
 */
export function isMentioned(text, userName) {
  if (!text || !userName || userName === '未知使用者') return false;
  const cleanName = userName.trim();
  if (!cleanName) return false;

  const patterns = ['@' + cleanName];
  if (cleanName.length >= 3) {
    // 例如「高皓宇」也匹配「@皓宇」
    patterns.push('@' + cleanName.slice(1));
  }

  for (const p of patterns) {
    if (text.includes(p)) return true;
  }
  return false;
}

/**
 * 從 localStorage 取得已讀取的提及清單
 */
export function getReadMentions() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * 標記特定提及為已讀取
 * @param {string} key 例如 'announcement:123' 或 'calendar:abc'
 */
export function markMentionAsRead(key) {
  if (!key || typeof window === 'undefined') return;
  try {
    const set = getReadMentions();
    if (!set.has(key)) {
      set.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
      window.dispatchEvent(new CustomEvent('wutps-mention-read', { detail: { key } }));
    }
  } catch (e) {
    console.warn('markMentionAsRead error', e);
  }
}

/**
 * 批次標記所有提及為已讀取
 * @param {string[]} keys 鍵值陣列
 */
export function markAllMentionsAsRead(keys) {
  if (!Array.isArray(keys) || keys.length === 0 || typeof window === 'undefined') return;
  try {
    const set = getReadMentions();
    keys.forEach(k => {
      if (k) set.add(k);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(new CustomEvent('wutps-mention-read', { detail: { keys } }));
  } catch (e) {
    console.warn('markAllMentionsAsRead error', e);
  }
}

/**
 * 解析文字內容，自動將 URL 轉換為可點擊超連結，並將 @姓名 轉換為醒目膠囊標籤
 */
export function renderContentWithLinksAndMentions(text, currentUserName = '', isDark = false) {
  if (!text) return null;

  // 1. 分割 URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 dark:text-emerald-400 underline break-all font-semibold hover:opacity-80"
        >
          {part}
        </a>
      );
    }

    // 2. 解析提及 @姓名 (支援繁簡中文字符與英數)
    const mentionRegex = /(@[\u4e00-\u9fa5A-Za-z0-9_]+)/g;
    const subParts = part.split(mentionRegex);

    return (
      <span key={index}>
        {subParts.map((sub, subIdx) => {
          if (sub.match(mentionRegex)) {
            const isMe = isMentioned(sub, currentUserName);
            return (
              <span
                key={subIdx}
                className={`inline-flex items-center font-bold px-1.5 py-0.5 mx-0.5 rounded-md text-xs border transition-all ${
                  isMe
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/90 dark:text-amber-200 dark:border-amber-700 shadow-xs'
                    : 'bg-stone-100 text-emerald-800 border-stone-200 dark:bg-slate-800 dark:text-emerald-300 dark:border-slate-700'
                }`}
              >
                {sub}
              </span>
            );
          }
          return <span key={subIdx} className="whitespace-pre-wrap">{sub}</span>;
        })}
      </span>
    );
  });
}
