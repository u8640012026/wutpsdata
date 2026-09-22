import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  CalendarDays,
  Plus, 
  X, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  AlertCircle,
  Search
} from 'lucide-react';
import { useApp } from '../App';
import { supabase } from '../supabaseClient';
import { roleTags as getRoleTags } from '../lib/staffAccess';
import { getAuthHeaders } from '../lib/authHeader';
import { getReadMentions, markMentionAsRead, isMentioned } from '../lib/mentionHelper';
import {
  parseToTaipeiParts,
  getCachedEvents,
  setCachedEvents,
  clearAllCalendarCache,
  formatEventDate,
  DEPARTMENTS,
  PERIODS
} from './calendar/calendarUtils';
import CalendarEventCard from './calendar/CalendarEventCard';
import EventDetailModal from './calendar/EventDetailModal';
import CalendarDrawer from './calendar/CalendarDrawer';

export default function SchoolCalendar({ isFullScreen, onToggleFullScreen }) {
  const { staffData, isDark } = useApp();
  
  // 權限判斷：Role 0(超管), 1(校長), 2(主任), 3(組長) 具備新增權限
  const roleTags = getRoleTags(staffData);
  const isSuperAdmin = roleTags.includes('0') || staffData?.email?.includes('u864001');
  const canManage = isSuperAdmin || roleTags.includes('1') || roleTags.includes('2') || roleTags.includes('3');
  const currentUid = staffData?.line_uid || '';
  const currentUserName = staffData?.name || '';
  
  // 提及與已讀狀態
  const [readSet, setReadSet] = useState(() => getReadMentions());
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    const syncRead = () => setReadSet(getReadMentions());
    window.addEventListener('wutps-mention-read', syncRead);
    return () => window.removeEventListener('wutps-mention-read', syncRead);
  }, []);

  useEffect(() => {
    if (canManage && currentUid) {
      fetch('/api/staff', { headers: getAuthHeaders(currentUid) })
        .then(r => r.ok ? r.json() : [])
        .then(data => { if (Array.isArray(data)) setStaffList(data); })
        .catch(() => {});
    }
  }, [canManage, currentUid]);

  // 狀態管理（優先讀取 localStorage 與記憶體雙層快取，實現 0 毫秒極速切換）
  const [filterType, setFilterType] = useState('all'); // all, wutai, ligu
  const [events, setEvents] = useState(() => getCachedEvents('all'));
  const [isLoading, setIsLoading] = useState(() => getCachedEvents('all').length === 0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 抽屜頁狀態 (新增 / 編輯)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 點選活動詳情彈窗
  const [selectedEvent, setSelectedEvent] = useState(null);
  const submissionIdRef = useRef(null);

  // 月份導航與關鍵字搜尋
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' 或 'YYYY-MM'
  const [searchQuery, setSearchQuery] = useState('');

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

  // 競態條件防護：紀錄目前活躍中的校區篩選條件
  const activeFilterRef = useRef(filterType);

  // 載入日曆活動（直接向 Supabase 查詢 69ms 極速回應，支援 isSilent 背景靜默更新）
  const loadEvents = async (isSilent = false) => {
    if (!isSilent && events.length === 0) {
      setIsLoading(true);
    }
    setErrorMsg('');
    try {
      // 1. 優先直接向 Supabase PostgREST 查詢 (69ms 秒開)
      let query = supabase
        .from('calendar_events')
        .select('*')
        .not('sync_status', 'in', '("pending_delete","failed_delete")');
      if (filterType === 'wutai') {
        query = query.in('calendar_type', ['all', 'wutai']);
      } else if (filterType === 'ligu') {
        query = query.in('calendar_type', ['all', 'ligu']);
      }
      query = query.order('start_time', { ascending: true });

      const { data: dbEvents, error: dbError } = await query;

      // 檢查是否已被使用者切換至其他校區，若已切換則丟棄舊回應
      if (activeFilterRef.current !== filterType) return;

      if (!dbError && Array.isArray(dbEvents) && dbEvents.length > 0) {
        const filtered = dbEvents.filter(ev => !['pending_delete', 'failed_delete'].includes(ev.sync_status));
        const mapped = filtered.map(ev => ({
          id: ev.id,
          gcal_event_id: ev.gcal_event_id || ev.id,
          calendarType: ev.calendar_type,
          title: ev.title,
          location: ev.location || '',
          description: ev.description || '',
          start: ev.start_time,
          end: ev.end_time || ev.start_time,
          isAllDay: Boolean(ev.is_all_day),
          periodInfo: ev.period_info || '',
          targetGrades: ev.target_grades || '全校所有班級',
          department: ev.department || '教務處',
          creatorName: ev.creator_name || '',
          syncStatus: ev.sync_status || 'synced'
        }));
        setCachedEvents(filterType, mapped);
        setEvents(mapped);
        setIsLoading(false);
        return;
      }

      // 2. 備援降級：若前端直讀失敗，呼叫後端 API
      const res = await fetch(`/api/calendar?type=${filterType}`);
      const json = await res.json();

      if (activeFilterRef.current !== filterType) return;

      if (json.status === 'success' && Array.isArray(json.data)) {
        const filteredData = json.data.filter(ev => !['pending_delete', 'failed_delete'].includes(ev.syncStatus || ev.sync_status));
        setCachedEvents(filterType, filteredData);
        setEvents(filteredData);
      } else {
        if (!isSilent) setErrorMsg(json.message || '無法取得日曆資料');
      }
    } catch (_err) {
      if (activeFilterRef.current !== filterType) return;
      if (!isSilent) setErrorMsg('連線異常，請稍後重試');
    } finally {
      if (activeFilterRef.current === filterType) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    activeFilterRef.current = filterType;
    const cached = getCachedEvents(filterType);
    if (cached.length > 0) {
      setEvents(cached);
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
    const todayParts = parseToTaipeiParts();
    setFormData({
      calendarType: filterType === 'all' ? 'all' : filterType,
      title: '',
      date: todayParts.date,
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
    submissionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));
    setIsDrawerOpen(true);
  };

  // 開啟編輯活動抽屜
  const handleOpenEdit = (ev) => {
    setEditingEventId(ev.id);
    setSelectedEvent(null);

    // 使用標準臺灣時區解析，防止 UTC 截字串產生的 8 小時偏移
    const startParts = parseToTaipeiParts(ev.start, '09:00');
    const endParts = parseToTaipeiParts(ev.end, '10:00');

    setFormData({
      calendarType: ev.calendarType || 'all',
      title: ev.title || '',
      date: startParts.date,
      timeMode: ev.isAllDay ? 'all_day' : 'custom',
      allDayType: 'full',
      startPeriod: 'p1',
      endPeriod: 'p4',
      customStartTime: startParts.time,
      customEndTime: endParts.time,
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUid)
        },
        body: JSON.stringify({
          action: 'delete',
          eventId,
          calendarType
        })
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setSelectedEvent(null);
        // 清空快取並立即重新整理
        clearAllCalendarCache();
        await loadEvents(false);
      } else {
        alert(json.message || '刪除失敗');
        // 刪除若失敗或進入 pending_delete / failed_delete 佇列，立即清空快取並重新整理過濾
        clearAllCalendarCache();
        await loadEvents(true);
      }
    } catch (_err) {
      alert('刪除請求失敗，請檢查網路狀態');
      clearAllCalendarCache();
      await loadEvents(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 從 Google 日曆單向/雙向拉取最新行程至系統
  const handleSyncFromGoogle = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUid)
        },
        body: JSON.stringify({ action: 'sync_from_gas' })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert(data.message || 'Google 日曆同步完成');
        clearAllCalendarCache();
        await loadEvents(false);
      } else {
        alert(data.message || '同步失敗');
      }
    } catch (err) {
      alert(`同步發生例外：${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 日期快速帶入（使用臺灣本地時區）
  const setQuickDate = (type) => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'next_monday') {
      const day = d.getDay();
      const diff = d.getDate() + (day === 0 ? 1 : 8 - day);
      d.setDate(diff);
    }
    const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
    setFormData(prev => ({ ...prev, date: dateStr }));
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
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders(currentUid)
          },
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
        // 新增活動 (POST) - 沿用同一個 client_event_id 防止重試或併發連點產生多筆活動
        if (!submissionIdRef.current) {
          submissionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));
        }
        const clientEventId = submissionIdRef.current;
        res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders(currentUid)
          },
          body: JSON.stringify({
            action: 'create',
            client_event_id: clientEventId,
            calendarType: formData.calendarType,
            title: formData.title.trim(),
            location: formData.location.trim(),
            description: desc,
            startTime,
            endTime,
            isAllDay,
            creatorName: currentUserName,
            creatorUid: currentUid
          })
        });
      }

      const resData = await res.json();
      if (res.ok && resData.status === 'success') {
        setSubmitSuccess(true);
        submissionIdRef.current = null;
        // 清除持久化快取以強制讀取最新資料
        clearAllCalendarCache();

        setTimeout(() => {
          setIsDrawerOpen(false);
          setEditingEventId(null);
          loadEvents(false);
        }, 400);
      } else {
        alert(resData.message || '儲存失敗，請檢查內容後重試');
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
    return canManage;
  };

  // 當前月份 Key (例如 '2026-09')
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }, []);

  // 依目前學年度學期與現有活動產生月份選單 (8月 ~ 1月 或 2月 ~ 7月 + 所有有活動的月份)
  const availableMonths = useMemo(() => {
    const baseMonthKeys = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
    
    const countMap = {};
    events.forEach(ev => {
      if (ev.start) {
        const d = new Date(ev.start);
        const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        countMap[k] = (countMap[k] || 0) + 1;
      }
    });

    const set = new Set([...baseMonthKeys, ...Object.keys(countMap)]);
    const sorted = Array.from(set).sort();

    return sorted.map(k => {
      const [y, m] = k.split('-');
      const numM = parseInt(m, 10);
      return {
        key: k,
        year: y,
        month: numM,
        label: `${numM}月`,
        fullLabel: `${y}年 ${numM}月`,
        count: countMap[k] || 0,
        isCurrent: k === currentMonthKey
      };
    });
  }, [events, currentMonthKey]);

  // 過濾與分組活動 (支援校區、月份篩選、關鍵字快速搜尋)
  const groupedEvents = useMemo(() => {
    let filtered = events;

    // 1. 關鍵字搜尋 (標題、地點、處室、備註、日期)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(ev => {
        const dateStr = formatEventDate(ev.start).full;
        return (
          (ev.title && ev.title.toLowerCase().includes(q)) ||
          (ev.location && ev.location.toLowerCase().includes(q)) ||
          (ev.department && ev.department.toLowerCase().includes(q)) ||
          (ev.description && ev.description.toLowerCase().includes(q)) ||
          (dateStr && dateStr.includes(q))
        );
      });
    }

    // 2. 月份篩選
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(ev => {
        if (!ev.start) return false;
        const d = new Date(ev.start);
        const k = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        return k === selectedMonth;
      });
    }

    // 3. 依月份 (YYYY-MM) 進行群組歸納
    const groups = {};
    filtered.forEach(ev => {
      const d = ev.start ? new Date(ev.start) : new Date();
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const k = `${y}-${m.toString().padStart(2, '0')}`;
      const label = `${y} 年 ${m} 月`;

      if (!groups[k]) {
        groups[k] = {
          key: k,
          year: y,
          month: m,
          label,
          events: []
        };
      }
      groups[k].events.push(ev);
    });

    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [events, selectedMonth, searchQuery]);

  // 計算目前顯示的活動總數
  const totalFilteredCount = useMemo(() => {
    return groupedEvents.reduce((acc, g) => acc + g.events.length, 0);
  }, [groupedEvents]);

  return (
    <div className="space-y-5">
      {/* ── 頂部控制欄：過濾膠囊 + 動作按鈕 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 校區過濾膠囊（手機版防折行緊湊化） */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-stone-100 dark:bg-slate-800/80 border border-stone-200 dark:border-slate-700 w-fit overflow-x-auto max-w-full flex-nowrap shrink-0 scrollbar-none">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterType === 'all'
                ? 'bg-white dark:bg-slate-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <span className="hidden sm:inline">全部顯示</span>
            <span className="sm:hidden">全校</span>
          </button>
          <button
            onClick={() => setFilterType('wutai')}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              filterType === 'wutai'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            <span className="hidden sm:inline">霧臺校區 (全+霧)</span>
            <span className="sm:hidden">霧臺</span>
          </button>
          <button
            onClick={() => setFilterType('ligu')}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              filterType === 'ligu'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
            <span className="hidden sm:inline">勵古百合 (全+勵)</span>
            <span className="sm:hidden">勵古</span>
          </button>
        </div>

        {/* 右側操作按鈕組 */}
        <div className="flex items-center gap-2">
          {/* 重新整理 */}
          <button
            onClick={() => {
              clearAllCalendarCache();
              loadEvents(false);
            }}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-slate-800 transition shadow-xs"
            title="重新整理行事曆"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* 與 Google 日曆雙向同步按鈕 (管理者專用) */}
          {canManage && (
            <button
              onClick={handleSyncFromGoogle}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-xs ${
                isDark 
                  ? 'border-slate-800 bg-slate-900 text-stone-300 hover:bg-slate-800' 
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
              title="將 Google 日曆最新活動雙向同步至系統"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-emerald-500' : ''} />
              <span>{isSyncing ? '同步中...' : '同步 Google'}</span>
            </button>
          )}

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

      {/* ── 月份選擇器與快速搜尋欄 ── */}
      <div className="space-y-3 p-3 rounded-2xl bg-stone-50/70 dark:bg-slate-900/50 border border-stone-200/70 dark:border-slate-800">
        {/* 月份標籤滑動列 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedMonth('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedMonth === 'all'
                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 border border-stone-200 dark:border-slate-700'
            }`}
          >
            <CalendarDays size={13} />
            <span>全部月份</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedMonth === 'all'
                ? 'bg-white/20 text-white dark:bg-stone-900/20 dark:text-stone-900'
                : 'bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-stone-300'
            }`}>
              {events.length}
            </span>
          </button>

          {availableMonths.map((m) => {
            const isSelected = selectedMonth === m.key;
            const hasEvents = m.count > 0;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(m.key)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 relative border ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : hasEvents
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-800/80 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 border-stone-200 dark:border-slate-700'
                }`}
              >
                <span>{m.label}</span>
                {m.isCurrent && (
                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                    isSelected ? 'bg-white/30 text-white' : 'bg-emerald-200/80 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100'
                  }`}>
                    本月
                  </span>
                )}
                {hasEvents && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-emerald-200 dark:bg-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                  }`}>
                    {m.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 搜尋欄與活動狀態資訊 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-stone-200/60 dark:border-slate-800/60">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋活動、處室、地點、日期或關鍵字..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-2">
            {selectedMonth !== 'all' ? (
              <span className="flex items-center gap-1.5">
                <span>指定月份：<strong className="text-stone-800 dark:text-stone-200">{availableMonths.find(m => m.key === selectedMonth)?.fullLabel}</strong></span>
                <button
                  onClick={() => setSelectedMonth('all')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                >
                  (看全部月份)
                </button>
              </span>
            ) : (
              <span>共 <strong>{totalFilteredCount}</strong> 則活動</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 錯誤提示 ── */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 行事曆內容檢視區 (依月份清晰群組歸類，徹底杜絕摺疊或遺漏) ── */}
      {isLoading && events.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin mx-auto text-emerald-600" />
          <p className="text-xs text-stone-400 dark:text-stone-500 font-medium">連線 Google 行事曆同步中...</p>
        </div>
      ) : totalFilteredCount === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900/30 space-y-2">
          <CalendarIcon size={36} className="mx-auto text-stone-300 dark:text-slate-700 mb-1" />
          <p className="text-sm font-bold text-stone-600 dark:text-stone-400">
            {searchQuery
              ? `找不到符合「${searchQuery}」的活動`
              : selectedMonth !== 'all'
                ? `${availableMonths.find(m => m.key === selectedMonth)?.fullLabel || ''} 尚無排定活動`
                : '目前尚無近期排定之活動'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {selectedMonth !== 'all' && (
              <button
                onClick={() => setSelectedMonth('all')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50"
              >
                查看全部月份
              </button>
            )}
            {canManage && (
              <button
                onClick={handleOpenCreate}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
              >
                ＋ 新增此月份活動
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEvents.map((group) => (
            <div key={group.key} className="space-y-3">
              {/* 月份分組清晰標題列 */}
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <h3 className="text-xs font-black tracking-wide text-stone-800 dark:text-stone-200">
                    {group.label}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border border-stone-200/60 dark:border-slate-700">
                    {group.events.length} 則活動
                  </span>
                </div>
              </div>

              {/* 活動卡片清單 */}
              <div className="space-y-3">
                {group.events.map((ev) => {
                  const mentionKey = `calendar:${ev.id}`;
                  const isMeMentioned = isMentioned(`${ev.title} ${ev.description || ''}`, currentUserName);

                  return (
                    <CalendarEventCard
                      key={ev.id}
                      ev={ev}
                      currentUserName={currentUserName}
                      readSet={readSet}
                      canMod={canModifyEvent(ev)}
                      onSelect={() => {
                        setSelectedEvent(ev);
                        if (isMeMentioned && !readSet.has(mentionKey)) {
                          markMentionAsRead(mentionKey);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 活動詳情與管理彈窗 ── */}
      <EventDetailModal
        selectedEvent={selectedEvent}
        currentUserName={currentUserName}
        isDark={isDark}
        canMod={canModifyEvent(selectedEvent)}
        isSubmitting={isSubmitting}
        onClose={() => setSelectedEvent(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteEvent}
      />

      {/* ── 新增 / 編輯活動滿版右側滑出抽屜 ── */}
      <CalendarDrawer
        isOpen={isDrawerOpen}
        editingEventId={editingEventId}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        submitSuccess={submitSuccess}
        staffList={staffList}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        setQuickDate={setQuickDate}
        toggleClass={toggleClass}
      />
    </div>
  );
}
