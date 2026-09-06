import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Plus, 
  X, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  ChevronRight, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { useApp } from '../App';

// 學校作息節次表（霧臺國小標準 14 節次）
const PERIODS = [
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
const WUTAI_LOCATIONS = ['視聽教室', '學習走廊', '風雨球場', '操場', '電腦教室', '校長室'];
const LIGU_LOCATIONS = ['多功能教室', '學習走廊', '風雨球場', '操場', '文化教室', '分校辦公室'];

// 對象班級點陣清單
const WUTAI_CLASSES = ['1甲', '2甲', '3甲', '4甲', '5甲', '6甲'];
const LIGU_CLASSES = ['1乙', '2乙', '3乙', '4乙', '5乙', '6乙'];
const KINDERGARTEN_CLASSES = ['小陶壺 (霧臺)', '小百合 (勵古)', '小雲豹 (勵古)'];

// 處室清單
const DEPARTMENTS = ['教務處', '學務處', '總務處', '輔導室', '幼兒園', '校長室'];

export default function SchoolCalendar({ isFullScreen, onToggleFullScreen }) {
  const { isDark, staffData } = useApp();
  
  // 權限判斷：Role 0(超管), 1(校長), 2(主任), 3(組長) 具備新增權限
  const roleTags = staffData?.role_tags || '';
  const canManage = roleTags.includes('0') || roleTags.includes('1') || roleTags.includes('2') || roleTags.includes('3') || staffData?.email?.includes('u864001');
  
  // 狀態管理
  const [filterType, setFilterType] = useState('all'); // all, wutai, ligu
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 檢視模式：timeline (時間軸), list (清單)
  const [viewMode, setViewMode] = useState('timeline');
  
  // 抽屜頁狀態
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // 點選活動詳情彈窗
  const [selectedEvent, setSelectedEvent] = useState(null);

  // 表單資料狀態
  const [formData, setFormData] = useState({
    calendarType: 'all', // all, wutai, ligu
    title: '',
    date: new Date().toISOString().slice(0, 10),
    timeMode: 'all_day', // all_day, periods, custom
    allDayType: 'full', // full, morning, afternoon
    startPeriod: 'p1',
    endPeriod: 'p4',
    customStartTime: '09:00',
    customEndTime: '10:00',
    location: '',
    isAllClasses: true,
    selectedClasses: [],
    department: DEPARTMENTS[0],
    notes: ''
  });

  // 載入日曆活動
  const loadEvents = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/calendar?type=${filterType}`);
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        setEvents(json.data);
      } else {
        setErrorMsg(json.message || '無法取得日曆資料');
      }
    } catch (err) {
      setErrorMsg('連線異常，請稍後重試');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [filterType]);

  // 依登入者預設承辦處室
  useEffect(() => {
    if (staffData?.department) {
      const matched = DEPARTMENTS.find(d => staffData.department.includes(d.slice(0, 2)));
      if (matched) {
        setFormData(prev => ({ ...prev, department: matched }));
      }
    }
  }, [staffData]);

  // 日期快速帶入
  const setQuickDate = (type) => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'next_monday') {
      const day = d.getDay();
      const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
      d.setDate(diff);
    }
    setFormData(prev => ({ ...prev, date: d.toISOString().slice(0, 10) }));
  };

  // 班級點陣切換
  const toggleClass = (className) => {
    setFormData(prev => {
      const exists = prev.selectedClasses.includes(className);
      const updated = exists 
        ? prev.selectedClasses.filter(c => c !== className)
        : [...prev.selectedClasses, className];
      return {
        ...prev,
        isAllClasses: false,
        selectedClasses: updated
      };
    });
  };

  // 送出新增活動
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('請填寫活動名稱');
      return;
    }

    setIsSubmitting(true);
    try {
      let isAllDay = false;
      let startTime = '';
      let endTime = '';

      if (formData.timeMode === 'all_day') {
        if (formData.allDayType === 'full') {
          isAllDay = true;
          startTime = `${formData.date}T00:00:00+08:00`;
          endTime = `${formData.date}T23:59:59+08:00`;
        } else if (formData.allDayType === 'morning') {
          startTime = `${formData.date}T08:00:00+08:00`;
          endTime = `${formData.date}T12:00:00+08:00`;
        } else {
          startTime = `${formData.date}T13:00:00+08:00`;
          endTime = `${formData.date}T16:00:00+08:00`;
        }
      } else if (formData.timeMode === 'periods') {
        const startP = PERIODS.find(p => p.id === formData.startPeriod) || PERIODS[1];
        const endP = PERIODS.find(p => p.id === formData.endPeriod) || startP;
        startTime = `${formData.date}T${startP.start}:00+08:00`;
        endTime = `${formData.date}T${endP.end}:00+08:00`;
      } else {
        startTime = `${formData.date}T${formData.customStartTime}:00+08:00`;
        endTime = `${formData.date}T${formData.customEndTime}:00+08:00`;
      }

      // 組合結構化說明
      const targetClassStr = formData.isAllClasses 
        ? '全校所有班級' 
        : (formData.selectedClasses.length > 0 ? formData.selectedClasses.join('、') : '依各處室通知');

      let desc = `【承辦處室】：${formData.department}\n【對象班級】：${targetClassStr}`;
      if (formData.timeMode === 'periods') {
        const startP = PERIODS.find(p => p.id === formData.startPeriod);
        const endP = PERIODS.find(p => p.id === formData.endPeriod);
        desc += `\n【學校節次】：${startP?.name || ''} 至 ${endP?.name || ''}`;
      }
      if (formData.notes.trim()) {
        desc += `\n【備註說明】：${formData.notes.trim()}`;
      }

      const payload = {
        calendarType: formData.calendarType,
        title: formData.title.trim(),
        location: formData.location.trim(),
        description: desc,
        startTime,
        endTime,
        isAllDay
      };

      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (resJson.status === 'success') {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          setIsDrawerOpen(false);
          loadEvents();
          // 重置表單
          setFormData(prev => ({
            ...prev,
            title: '',
            notes: '',
            isAllClasses: true,
            selectedClasses: []
          }));
        }, 1200);
      } else {
        alert(`新增失敗：${resJson.message || '請重試'}`);
      }
    } catch (err) {
      alert(`送出異常：${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 樣式輔助工具
  const getCalendarBadge = (calType) => {
    switch (calType) {
      case 'wutai':
        return {
          label: '霧臺校區',
          container: 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
        };
      case 'ligu':
        return {
          label: '勵古百合',
          container: 'bg-rose-50 border-rose-200 text-rose-950 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-200',
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
        };
      default:
        return {
          label: '全校共通',
          container: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
        };
    }
  };

  const formatEventTime = (ev) => {
    if (ev.isAllDay) return '全天活動';
    try {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      const formatDigit = (n) => String(n).padStart(2, '0');
      return `${formatDigit(s.getHours())}:${formatDigit(s.getMinutes())} - ${formatDigit(e.getHours())}:${formatDigit(e.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const formatEventDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      return {
        month: d.getMonth() + 1,
        day: d.getDate(),
        weekday: weekdays[d.getDay()],
        full: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
      };
    } catch {
      return { month: '', day: '', weekday: '', full: '' };
    }
  };

  return (
    <div className="space-y-5">
      {/* ── 頂部控制欄：過濾膠囊 + 動作按鈕 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 校區過濾膠囊 */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 w-fit">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'bg-white dark:bg-slate-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            全部顯示
          </button>
          <button
            onClick={() => setFilterType('wutai')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'wutai'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            霧臺校區 (全+霧)
          </button>
          <button
            onClick={() => setFilterType('ligu')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterType === 'ligu'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            勵古百合 (全+勵)
          </button>
        </div>

        {/* 右側操作按鈕組 */}
        <div className="flex items-center gap-2">
          {/* 重新整理 */}
          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition"
            title="從 Google 日曆重新整理"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* 全螢幕切換按鈕 */}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition"
              title={isFullScreen ? '退出全螢幕' : '全頁檢視'}
            >
              {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}

          {/* 新增活動（毛玻璃森林綠） */}
          {canManage && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-600/25 backdrop-blur-md transition-all"
            >
              <Plus size={15} />
              <span>新增活動</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 錯誤提示 ── */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 行事曆內容檢視區 ── */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin mx-auto text-emerald-600" />
          <p className="text-xs text-stone-400 dark:text-stone-500 font-medium">連線 Google 行事曆同步中...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900/30">
          <CalendarIcon size={36} className="mx-auto text-stone-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold text-stone-600 dark:text-stone-400">目前尚無近期排定之活動</p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">行政同仁點擊右上角「＋ 新增活動」即可即時同步至全校日曆</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const badgeStyle = getCalendarBadge(ev.calendarType);
            const dateInfo = formatEventDate(ev.start);
            const timeStr = formatEventTime(ev);

            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedEvent(ev)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.005] active:scale-[0.995] ${badgeStyle.container}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* 左側：日期方塊 + 標題內容 */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* 日期小標籤 */}
                    <div className="shrink-0 text-center px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 shadow-xs border border-stone-200/50 dark:border-slate-700/50 min-w-[52px]">
                      <span className="block text-[10px] font-bold text-stone-400 dark:text-stone-500">{dateInfo.weekday}</span>
                      <span className="block text-base font-black leading-tight text-stone-800 dark:text-stone-100">{dateInfo.month}/{dateInfo.day}</span>
                    </div>

                    {/* 活動核心資訊 */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeStyle.badge}`}>
                          {badgeStyle.label}
                        </span>
                        <h4 className="text-sm font-bold truncate text-stone-900 dark:text-stone-100">
                          {ev.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-xs opacity-80 flex-wrap">
                        {timeStr && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {timeStr}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={12} />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-stone-400 shrink-0 mt-2" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── 活動詳情彈窗 ── */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCalendarBadge(selectedEvent.calendarType).badge}`}>
                    {getCalendarBadge(selectedEvent.calendarType).label}
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">
                    {selectedEvent.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300 border-y border-stone-100 dark:border-slate-800/80 py-3">
                <p className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-stone-400" />
                  <span className="font-semibold">{formatEventDate(selectedEvent.start).full} ({formatEventDate(selectedEvent.start).weekday})</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={14} className="text-stone-400" />
                  <span>{formatEventTime(selectedEvent)}</span>
                </p>
                {selectedEvent.location && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-stone-400" />
                    <span>{selectedEvent.location}</span>
                  </p>
                )}
              </div>

              {selectedEvent.description && (
                <div className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                  {selectedEvent.description}
                </div>
              )}

              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
              >
                關閉
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 新增活動滿版右側滑出抽屜 (Slide-over Drawer) ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* 遮罩背景 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* 抽屜本體 */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-16">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-screen max-w-lg bg-white dark:bg-slate-900 border-l border-stone-200 dark:border-slate-800 shadow-2xl flex flex-col"
              >
                {/* 抽屜頂部 Header */}
                <div className="p-5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                      <CalendarIcon size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">新增校務行事活動</h3>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500">將即時寫入 Google 全校官方日曆</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    disabled={isSubmitting}
                    className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 抽屜表單內容 (可滾動) */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* 1. 所屬行事曆（三選一） */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      所屬行事曆
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'all' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'all'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        全校共通
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'wutai' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'wutai'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        霧臺校區
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'ligu' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'ligu'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        勵古百合
                      </button>
                    </div>
                  </div>

                  {/* 2. 活動名稱 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                      <span>活動名稱</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="例：第二次期中評量 / 文化走讀"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 3. 日期選擇 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        活動日期
                      </label>
                      {/* 頂部快捷膠囊 */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuickDate('today')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                        >
                          今天
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('tomorrow')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                        >
                          明天
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('next_monday')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                        >
                          下週一
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 4. 時間模式（分段切換） */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      時間模式
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'all_day' }))}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${
                          formData.timeMode === 'all_day'
                            ? 'bg-white dark:bg-slate-900 text-stone-900 dark:text-stone-100 shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        整天 / 半日
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'periods' }))}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${
                          formData.timeMode === 'periods'
                            ? 'bg-white dark:bg-slate-900 text-stone-900 dark:text-stone-100 shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        學校節次
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'custom' }))}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${
                          formData.timeMode === 'custom'
                            ? 'bg-white dark:bg-slate-900 text-stone-900 dark:text-stone-100 shadow-xs'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        自訂時間
                      </button>
                    </div>

                    {/* 整天模式選項 */}
                    {formData.timeMode === 'all_day' && (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {['full', 'morning', 'afternoon'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, allDayType: t }))}
                            className={`py-2 rounded-xl text-xs font-medium border ${
                              formData.allDayType === t
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold'
                                : 'bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-400'
                            }`}
                          >
                            {t === 'full' ? '全日' : t === 'morning' ? '上午 (08:00-12:00)' : '下午 (13:00-16:00)'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 學校節次模式 */}
                    {formData.timeMode === 'periods' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="block text-[10px] text-stone-400 mb-1">起始節次</span>
                          <select
                            value={formData.startPeriod}
                            onChange={e => setFormData(prev => ({ ...prev, startPeriod: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none"
                          >
                            {PERIODS.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.start})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <span className="block text-[10px] text-stone-400 mb-1">結束節次</span>
                          <select
                            value={formData.endPeriod}
                            onChange={e => setFormData(prev => ({ ...prev, endPeriod: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none"
                          >
                            {PERIODS.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.end})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 自訂時間模式 */}
                    {formData.timeMode === 'custom' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="block text-[10px] text-stone-400 mb-1">開始時間</span>
                          <input
                            type="time"
                            value={formData.customStartTime}
                            onChange={e => setFormData(prev => ({ ...prev, customStartTime: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none"
                          />
                        </div>
                        <div>
                          <span className="block text-[10px] text-stone-400 mb-1">結束時間</span>
                          <input
                            type="time"
                            value={formData.customEndTime}
                            onChange={e => setFormData(prev => ({ ...prev, customEndTime: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. 地點選擇（校區快捷膠囊 + 輸入框） */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      活動地點
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="點擊下方快捷標籤或自行輸入"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-emerald-500"
                    />

                    {/* 霧臺快捷標籤（綠色） */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">霧臺校區場地：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {WUTAI_LOCATIONS.map(loc => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, location: `霧臺校區 ${loc}` }))}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 勵古快捷標籤（紅色） */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold">勵古百合分校場地：</span>
                      <div className="flex flex-wrap gap-1.5">
                        {LIGU_LOCATIONS.map(loc => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, location: `勵古分校 ${loc}` }))}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 6. 對象班級（點陣按鈕） */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        對象班級
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isAllClasses}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            isAllClasses: e.target.checked,
                            selectedClasses: e.target.checked ? [] : prev.selectedClasses
                          }))}
                          className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-bold">全校所有班級</span>
                      </label>
                    </div>

                    {!formData.isAllClasses && (
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/30 space-y-2">
                        {/* 第一排：霧臺甲班（綠色） */}
                        <div>
                          <span className="text-[10px] text-emerald-600 font-bold block mb-1">霧臺校區：</span>
                          <div className="grid grid-cols-6 gap-1">
                            {WUTAI_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 第二排：勵古乙班（紅色） */}
                        <div>
                          <span className="text-[10px] text-rose-600 font-bold block mb-1">勵古百合：</span>
                          <div className="grid grid-cols-6 gap-1">
                            {LIGU_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 第三排：幼兒園 */}
                        <div>
                          <span className="text-[10px] text-amber-600 font-bold block mb-1">幼兒園：</span>
                          <div className="grid grid-cols-3 gap-1">
                            {KINDERGARTEN_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 7. 承辦處室 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      承辦處室
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DEPARTMENTS.map(dept => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, department: dept }))}
                          className={`py-2 rounded-xl text-xs font-medium border ${
                            formData.department === dept
                              ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold border-stone-900 dark:border-white'
                              : 'bg-stone-50 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-400'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 8. 活動備註 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      活動備註（選填）
                    </label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="請填寫攜帶器材、注意事項或補充說明..."
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 抽屜底部送出列 */}
                  <div className="pt-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || submitSuccess}
                      className={`w-full py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                        submitSuccess
                          ? 'bg-emerald-600'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-600/30'
                      }`}
                    >
                      {submitSuccess ? (
                        <>
                          <Check size={16} />
                          <span>新增成功，已同步至 Google 日曆！</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>正在同步至 Google 日曆...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          <span>確認並發布至 Google 日曆</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
