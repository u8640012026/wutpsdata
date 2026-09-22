// 標準化臺灣時區 (Asia/Taipei, UTC+8) 解析工具，杜絕 UTC 截字串產生的 8 小時偏移
export function parseToTaipeiParts(isoString, defaultTime = '09:00') {
  if (!isoString) {
    const now = new Date();
    const date = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    return { date, time: defaultTime };
  }

  // 若為純日期格式 (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return { date: isoString, time: defaultTime };
  }

  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    const fallbackDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    return { date: fallbackDate, time: defaultTime };
  }

  const date = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return { date, time };
}

// SWR 前端持久化與記憶體雙層快取（保證切換頁面 0 毫秒極速瞬開）
export const CACHE_PREFIX = 'wutps_cal_v4_';
export const calendarMemoryCache = {
  all: null,
  wutai: null,
  ligu: null,
  timestamp: 0
};

export function getCachedEvents(type) {
  const filterActiveOnly = (items) => {
    if (!Array.isArray(items)) return [];
    return items.filter(ev => !['pending_delete', 'failed_delete'].includes(ev.syncStatus || ev.sync_status));
  };

  if (calendarMemoryCache[type] && Array.isArray(calendarMemoryCache[type]) && calendarMemoryCache[type].length > 0) {
    const valid = filterActiveOnly(calendarMemoryCache[type]);
    calendarMemoryCache[type] = valid;
    return valid;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + type);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = filterActiveOnly(parsed);
          calendarMemoryCache[type] = valid;
          return valid;
        }
      }
    } catch {}
  }
  return [];
}

export function setCachedEvents(type, data) {
  calendarMemoryCache[type] = data;
  calendarMemoryCache.timestamp = Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_PREFIX + type, JSON.stringify(data));
    } catch {}
  }
}

export function clearAllCalendarCache() {
  calendarMemoryCache.all = null;
  calendarMemoryCache.wutai = null;
  calendarMemoryCache.ligu = null;
  calendarMemoryCache.timestamp = 0;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_PREFIX + 'all');
      localStorage.removeItem(CACHE_PREFIX + 'wutai');
      localStorage.removeItem(CACHE_PREFIX + 'ligu');
      // 同步清理歷史舊版快取 (v3, 舊無前綴版)
      localStorage.removeItem('wutps_cal_v3_all');
      localStorage.removeItem('wutps_cal_v3_wutai');
      localStorage.removeItem('wutps_cal_v3_ligu');
      localStorage.removeItem('wutps_cal_all');
      localStorage.removeItem('wutps_cal_wutai');
      localStorage.removeItem('wutps_cal_ligu');
    } catch {}
  }
}

// 計算學期週次 (相容 115 學年度第 1、第 2 學期校曆標準)
export const getSchoolWeek = (d) => {
  if (!d) return null;
  const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // 115 學年度第 1 學期 (2026/08/31 ~ 2027/01/24)
  const term1Start = new Date('2026-08-31T00:00:00+08:00');
  const term1End = new Date('2027-01-24T23:59:59+08:00');
  if (dNorm >= term1Start && dNorm <= term1End) {
    const diffDays = Math.floor((dNorm - term1Start) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `第 ${weekNum} 週`;
  }

  // 115 學年度第 2 學期 (2027/02/15 ~ 2027/07/04)
  const term2Start = new Date('2027-02-15T00:00:00+08:00');
  const term2End = new Date('2027-07-04T23:59:59+08:00');
  if (dNorm >= term2Start && dNorm <= term2End) {
    const diffDays = Math.floor((dNorm - term2Start) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
    return `下學期 第 ${weekNum} 週`;
  }

  return null;
};

// 計算相對日期狀態 (今天、明天、後天、X天後、已過期)
export const getRelativeDateInfo = (d) => {
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: '今天', color: 'bg-emerald-500 text-white font-bold' };
  if (diffDays === 1) return { label: '明天', color: 'bg-amber-500 text-white font-bold' };
  if (diffDays === 2) return { label: '後天', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' };
  if (diffDays > 2 && diffDays <= 7) return { label: `${diffDays}天後`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' };
  if (diffDays > 7) return { label: `${diffDays}天後`, color: 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-stone-300' };
  if (diffDays < 0) return { label: '已過期', color: 'bg-stone-100 text-stone-400 dark:bg-slate-800 dark:text-stone-500 line-through' };
  return null;
};

// 學校作息節次表（霧臺國小標準 14 節次）
export const PERIODS = [
  { id: 'morning_study', name: '早自習', start: '07:50', end: '08:30' },
  { id: 'p1', name: '第 1 節', start: '08:40', end: '09:20' },
  { id: 'p2', name: '第 2 節', start: '09:30', end: '10:10' },
  { id: 'recess', name: '課間活動', start: '10:10', end: '10:30' },
  { id: 'p3', name: '第 3 節', start: '10:30', end: '11:10' },
  { id: 'p4', name: '第 4 節', start: '11:20', end: '12:00' },
  { id: 'lunch', name: '午餐時間', start: '12:00', end: '12:40' },
  { id: 'nap', name: '午休時間', start: '12:40', end: '13:20' },
  { id: 'p5', name: '第 5 節', start: '13:30', end: '14:10' },
  { id: 'p6', name: '第 6 節', start: '14:20', end: '15:00' },
  { id: 'p7', name: '第 7 節', start: '15:10', end: '15:50' },
  { id: 'p8', name: '第 8 節', start: '16:00', end: '16:40' },
  { id: 'p9', name: '課後第 9 節', start: '16:40', end: '17:20' },
  { id: 'p10', name: '課後第 10 節', start: '17:20', end: '18:00' }
];

// 校區快捷地點
export const WUTAI_LOCATIONS = ['視聽教室', '學習走廊', '風雨球場', '操場', '電腦教室', '校長室'];
export const LIGU_LOCATIONS = ['多功能教室', '學習走廊', '風雨球場', '操場', '文化教室', '分校辦公室'];

// 對象班級點陣清單
export const WUTAI_CLASSES = ['1甲', '2甲', '3甲', '4甲', '5甲', '6甲'];
export const LIGU_CLASSES = ['1乙', '2乙', '3乙', '4乙', '5乙', '6乙'];
export const KINDERGARTEN_CLASSES = ['小陶壺 (霧臺)', '小百合 (勵古)', '小雲豹 (勵古)'];

// 處室清單
export const DEPARTMENTS = ['教務處', '學務處', '總務處', '輔導室', '幼兒園', '校長室'];

// 輔助函式：校區色彩標籤樣式
export const getCalendarBadge = (calType) => {
  switch (calType) {
    case 'wutai':
      return {
        label: '霧臺校區',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        border: 'border-l-emerald-500'
      };
    case 'ligu':
      return {
        label: '勵古百合',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        dot: 'bg-rose-500',
        border: 'border-l-rose-500'
      };
    default:
      return {
        label: '全校共通',
        badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500',
        border: 'border-l-blue-500'
      };
  }
};

// 格式化日期顯示（含月份、日期、星期、學期週次、相對時間）
export const formatEventDate = (dateStr) => {
  if (!dateStr) return { month: '', day: '', weekday: '', full: '', schoolWeek: null, relative: null };
  const date = new Date(dateStr);
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const schoolWeek = getSchoolWeek(date);
  const relative = getRelativeDateInfo(date);
  return {
    month: `${date.getMonth() + 1}月`,
    day: `${date.getDate()}`,
    weekday: weekdays[date.getDay()],
    full: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    schoolWeek,
    relative
  };
};

// 格式化時間區間
export const formatEventTime = (ev) => {
  if (ev.isAllDay) return '全天活動';
  if (!ev.start) return '';
  const start = new Date(ev.start);
  const end = ev.end ? new Date(ev.end) : start;
  const startStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
  const endStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
  return `${startStr} - ${endStr}`;
};
