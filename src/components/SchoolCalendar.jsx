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
  AlertCircle,
  Edit2,
  Trash2,
  UserCheck
} from 'lucide-react';
import { useApp } from '../App';

// SWR 前端記憶體快取（保證切換頁面 0 毫秒極速秒開）
const calendarMemoryCache = {
  all: null,
  wutai: null,
  ligu: null,
  timestamp: 0
};

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
  const { staffData } = useApp();
  
  // 權限判斷：Role 0(超管), 1(校長), 2(主任), 3(組長) 具備新增權限
  const roleTags = staffData?.role_tags || '';
  const isSuperAdmin = roleTags.includes('0') || staffData?.email?.includes('u864001');
  const canManage = isSuperAdmin || roleTags.includes('1') || roleTags.includes('2') || roleTags.includes('3');
  const currentUid = staffData?.line_uid || '';
  const currentUserName = staffData?.name || '';
  
  // 狀態管理（優先讀取記憶體快取，實現 0 毫秒極速切換）
  const [filterType, setFilterType] = useState('all'); // all, wutai, ligu
  const [events, setEvents] = useState(() => calendarMemoryCache['all'] || []);
  const [isLoading, setIsLoading] = useState(() => !calendarMemoryCache['all']);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 抽屜頁狀態 (新增 / 編輯)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
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

  // 載入日曆活動（支援 isSilent 背景靜默更新）
  const loadEvents = async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    setErrorMsg('');
    try {
      const res = await fetch(`/api/calendar?type=${filterType}`);
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        calendarMemoryCache[filterType] = json.data;
        calendarMemoryCache.timestamp = Date.now();
        setEvents(json.data);
      } else {
        if (!isSilent) setErrorMsg(json.message || '無法取得日曆資料');
      }
    } catch (_err) {
      if (!isSilent) setErrorMsg('連線異常，請稍後重試');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (calendarMemoryCache[filterType]) {
      setEvents(calendarMemoryCache[filterType]);
      setIsLoading(false);
      // 背景靜默刷新最新資料
      loadEvents(true);
    } else {
      loadEvents(false);
    }
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

  // 開啟新增活動抽屜
  const handleOpenCreate = () => {
    setEditingEventId(null);
    setFormData({
      calendarType: filterType === 'all' ? 'all' : filterType,
      title: '',
      date: new Date().toISOString().slice(0, 10),
      timeMode: 'all_day',
      allDayType: 'full',
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
    setSubmitSuccess(false);
    setIsDrawerOpen(true);
  };

  // 開啟編輯活動抽屜
  const handleOpenEdit = (ev) => {
    setEditingEventId(ev.id);
    setSelectedEvent(null);

    const startDate = ev.start ? ev.start.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const startT = ev.start ? ev.start.slice(11, 16) : '09:00';
    const endT = ev.end ? ev.end.slice(11, 16) : '10:00';

    setFormData({
      calendarType: ev.calendarType || 'all',
      title: ev.title || '',
      date: startDate,
      timeMode: ev.isAllDay ? 'all_day' : 'custom',
      allDayType: 'full',
      startPeriod: 'p1',
      endPeriod: 'p4',
      customStartTime: startT,
      customEndTime: endT,
      location: ev.location || '',
      isAllClasses: !ev.description || ev.description.includes('全校所有班級'),
      selectedClasses: [],
      department: DEPARTMENTS[0],
      notes: ev.description || ''
    });
    setSubmitSuccess(false);
    setIsDrawerOpen(true);
  };

  // 刪除活動
  const handleDeleteEvent = async (eventId, calendarType) => {
    if (!window.confirm('確定要從 Google 日曆永久刪除此活動嗎？\n（此動作將直接自雲端日曆移除）')) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          eventId,
          calendarType
        })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setSelectedEvent(null);
        // 清空快取並立即重新整理
        calendarMemoryCache.all = null;
        calendarMemoryCache.wutai = null;
        calendarMemoryCache.ligu = null;
        await loadEvents(false);
      } else {
        alert(json.message || '刪除失敗');
      }
    } catch (_err) {
      alert('刪除請求失敗，請檢查網路狀態');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // 送出新增 / 編輯活動
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
        desc += `\n【作息節次】：${startP?.name || ''} 至 ${endP?.name || ''}`;
      }
      if (formData.notes.trim()) {
        desc += `\n【詳細備註】：${formData.notes.trim()}`;
      }

      // 自動記錄建立者身分 (利於權限稽核與編輯)
      const creatorSign = currentUserName 
        ? `\n【建立者】：${currentUserName} (UID: ${currentUid || 'admin'})`
        : '';
      desc += creatorSign;

      let res;
      if (editingEventId) {
        // 編輯活動 (PUT)
        res = await fetch('/api/calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            eventId: editingEventId,
            calendarType: formData.calendarType,
            title: formData.title.trim(),
            location: formData.location.trim(),
            description: desc,
            startTime,
            endTime,
            isAllDay
          })
        });
      } else {
        // 新增活動 (POST)
        res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            calendarType: formData.calendarType,
            title: formData.title.trim(),
            location: formData.location.trim(),
            description: desc,
            startTime,
            endTime,
            isAllDay
          })
        });
      }

      const resData = await res.json();
      if (res.ok && resData.status === 'success') {
        setSubmitSuccess(true);
        // 清除記憶體快取以強制讀取最新資料
        calendarMemoryCache.all = null;
        calendarMemoryCache.wutai = null;
        calendarMemoryCache.ligu = null;

        setTimeout(() => {
          setIsDrawerOpen(false);
          setEditingEventId(null);
          loadEvents(false);
        }, 1200);
      } else {
        alert(resData.message || '操作失敗，請稍後重試');
      }
    } catch (err) {
      alert(`發生錯誤：${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 輔助函式：判斷是否擁有編輯/刪除權限
  const canModifyEvent = (ev) => {
    if (!ev) return false;
    if (isSuperAdmin) return true; // Role 0 超級管理員擁有所有事件的修改/刪除權限
    if (currentUid && ev.description && ev.description.includes(currentUid)) return true;
    if (currentUserName && ev.description && ev.description.includes(`【建立者】：${currentUserName}`)) return true;
    return false;
  };

  // 輔助函式：校區色彩標籤樣式
  const getCalendarBadge = (calType) => {
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

  // 格式化日期顯示
  const formatEventDate = (dateStr) => {
    if (!dateStr) return { month: '', day: '', weekday: '', full: '' };
    const date = new Date(dateStr);
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return {
      month: `${date.getMonth() + 1}月`,
      day: `${date.getDate()}`,
      weekday: weekdays[date.getDay()],
      full: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
    };
  };

  // 格式化時間區間
  const formatEventTime = (ev) => {
    if (ev.isAllDay) return '全天活動';
    if (!ev.start) return '';
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : start;
    const startStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
    const endStr = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
    return `${startStr} - ${endStr}`;
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
            onClick={() => {
              calendarMemoryCache[filterType] = null;
              loadEvents(false);
            }}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition shadow-xs"
            title="從 Google 日曆重新整理"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* 全螢幕切換按鈕 */}
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition shadow-xs"
              title={isFullScreen ? '退出全頁' : '全頁檢視'}
            >
              {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}

          {/* 新增活動 */}
          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-600/25 transition-all"
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
      {isLoading && events.length === 0 ? (
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
            const canMod = canModifyEvent(ev);

            return (
              <motion.div
                key={ev.id}
                layout
                onClick={() => setSelectedEvent(ev)}
                className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all cursor-pointer border-l-4 ${badgeStyle.border} border-stone-200 dark:border-slate-800 active:scale-[0.99]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* 左側日期卡塊 */}
                    <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-stone-200/60 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400">{dateInfo.month}</span>
                      <span className="text-base font-black text-stone-900 dark:text-stone-100 leading-none">{dateInfo.day}</span>
                    </div>

                    {/* 活動主體內容 */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeStyle.badge}`}>
                          {badgeStyle.label}
                        </span>
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {ev.title}
                        </h4>
                        {canMod && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400 flex items-center gap-1">
                            <UserCheck size={10} />
                            可編修
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CalendarIcon size={12} />
                          {dateInfo.weekday}
                        </span>
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

      {/* ── 活動詳情與管理彈窗 (含編輯與刪除權限控制) ── */}
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCalendarBadge(selectedEvent.calendarType).badge}`}>
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
                  <CalendarIcon size={14} className="text-stone-400 shrink-0" />
                  <span className="font-semibold">{formatEventDate(selectedEvent.start).full} ({formatEventDate(selectedEvent.start).weekday})</span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={14} className="text-stone-400 shrink-0" />
                  <span>{formatEventTime(selectedEvent)}</span>
                </p>
                {selectedEvent.location && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-stone-400 shrink-0" />
                    <span>{selectedEvent.location}</span>
                  </p>
                )}
              </div>

              {selectedEvent.description && (
                <div className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {selectedEvent.description}
                </div>
              )}

              {/* 權限按鈕組：Role 0 超管全權限 / 建立者可編修 */}
              <div className="pt-2 flex items-center gap-2">
                {canModifyEvent(selectedEvent) ? (
                  <>
                    <button
                      onClick={() => handleOpenEdit(selectedEvent)}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800 transition"
                    >
                      <Edit2 size={13} />
                      <span>編輯活動</span>
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.calendarType)}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-800 transition"
                    >
                      <Trash2 size={13} />
                      <span>{isSubmitting ? '刪除中...' : '刪除此活動'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                  >
                    關閉
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 新增 / 編輯活動滿版右側滑出抽屜 (Slide-over Drawer) ── */}
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
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {editingEventId ? '編輯校務行事活動' : '新增校務行事活動'}
                      </h3>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500">
                        {editingEventId ? '修改將即時同步至 Google 官方日曆' : '將即時寫入 Google 全校官方日曆'}
                      </p>
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
                      placeholder="例：全校行政晨會、期中學習評量、親職教育日"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 3. 活動日期 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        活動日期
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickDate('tomorrow')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200"
                        >
                          明日
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('next_monday')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200"
                        >
                          下週一
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 4. 時間模式選擇 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      時間排程模式
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'all_day' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'all_day'
                            ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        整天 / 半天
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'periods' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'periods'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        依作息節次
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'custom' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'custom'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        自訂時段
                      </button>
                    </div>

                    {/* 依不同時間模式展開子設定 */}
                    {formData.timeMode === 'all_day' && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 flex items-center justify-around text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'full'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'full' }))}
                            className="text-emerald-600"
                          />
                          <span>全天</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'morning'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'morning' }))}
                            className="text-emerald-600"
                          />
                          <span>上午半天</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'afternoon'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'afternoon' }))}
                            className="text-emerald-600"
                          />
                          <span>下午半天</span>
                        </label>
                      </div>
                    )}

                    {formData.timeMode === 'periods' && (
                      <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">開始節次</label>
                            <select
                              value={formData.startPeriod}
                              onChange={(e) => setFormData(prev => ({ ...prev, startPeriod: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            >
                              {PERIODS.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.start})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">結束節次</label>
                            <select
                              value={formData.endPeriod}
                              onChange={(e) => setFormData(prev => ({ ...prev, endPeriod: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            >
                              {PERIODS.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.end})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.timeMode === 'custom' && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">開始時間</label>
                          <input
                            type="time"
                            value={formData.customStartTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, customStartTime: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">結束時間</label>
                          <input
                            type="time"
                            value={formData.customEndTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, customEndTime: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. 地點選擇與快捷點選 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      活動地點
                    </label>
                    <input
                      type="text"
                      placeholder="例：視聽教室、風雨球場、全校操場"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />

                    {/* 依校區提供推薦地點 */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(formData.calendarType === 'ligu' ? LIGU_LOCATIONS : WUTAI_LOCATIONS).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                            formData.location === loc
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. 對象班級點陣快速勾選 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        對象班級
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isAllClasses: !prev.isAllClasses, selectedClasses: [] }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          formData.isAllClasses
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        全校所有班級
                      </button>
                    </div>

                    {!formData.isAllClasses && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">霧臺國小本校</span>
                          <div className="grid grid-cols-6 gap-1.5">
                            {WUTAI_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition text-center ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">勵古百合分校</span>
                          <div className="grid grid-cols-6 gap-1.5">
                            {LIGU_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition text-center ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">幼兒園</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {KINDERGARTEN_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition text-center truncate ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
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

                  {/* 7. 主辦處室 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      承辦處室
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* 8. 備註與詳細說明 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      備註與注意事項
                    </label>
                    <textarea
                      rows={3}
                      placeholder="填寫活動詳細說明、裝備需求或相關流程..."
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 抽屜底層送出按鈕 */}
                  <div className="pt-4 border-t border-stone-100 dark:border-slate-800">
                    <button
                      type="submit"
                      disabled={isSubmitting || submitSuccess}
                      className={`w-full py-3 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                        submitSuccess
                          ? 'bg-emerald-700 shadow-emerald-700/25'
                          : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/25'
                      }`}
                    >
                      {submitSuccess ? (
                        <>
                          <Check size={16} />
                          <span>{editingEventId ? '更新成功！已同步至 Google 日曆' : '發布成功！已同步至 Google 日曆'}</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>正在同步至 Google 日曆...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          <span>{editingEventId ? '確認並儲存修改' : '確認並發布至 Google 日曆'}</span>
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
