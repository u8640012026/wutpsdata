import React, { useState, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';
import { useApp } from '../App';
import { canManageRepairs, isSuperAdmin, roleTags } from '../lib/staffAccess';
import { 
  Wrench, 
  ShoppingCart, 
  Plus, 
  ArrowLeft, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  MapPin, 
  Calendar, 
  FileText, 
  Camera, 
  X, 
  Settings,
  Check
} from 'lucide-react';

export function parseRepairCampus(location = '') {
  const loc = String(location || '');
  if (loc.includes('[勵古分校]') || loc.includes('勵古')) {
    return {
      key: 'ligu',
      label: '勵古分校',
      badgeClass: 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
      cleanLocation: loc.replace(/\[勵古分校\]\s*/g, '').trim() || loc
    };
  }
  if (loc.includes('[全校共通]') || loc.includes('全校')) {
    return {
      key: 'all_campus',
      label: '全校共通',
      badgeClass: 'border-sky-500/40 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
      cleanLocation: loc.replace(/\[全校共通\]\s*/g, '').trim() || loc
    };
  }
  return {
    key: 'wutai',
    label: '霧臺校區',
    badgeClass: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    cleanLocation: loc.replace(/\[霧臺校區\]\s*/g, '').trim() || loc
  };
}

export default function RepairDashboard() {
  const { isDark, setHideBottomNav, liffProfile, staffData, setRepairBadgeCount, fetchRepairBadge } = useApp();
  const [view, setView] = useState('list'); // 'list', 'form', 'detail'

  // 填報表單或檢視詳情時自動隱藏底部導覽列
  useEffect(() => {
    setHideBottomNav?.(view !== 'list');
    return () => setHideBottomNav?.(false);
  }, [view, setHideBottomNav]);

  const [filter, setFilter] = useState('all'); // 'all', 'repair', 'purchase'
  const [campusFilter, setCampusFilter] = useState('all'); // 'all', 'wutai', 'ligu', 'all_campus'
  const [showHistory, setShowHistory] = useState(false);
  const [repairs, setRepairs] = useState([]);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [type, setType] = useState('repair');
  const [campus, setCampus] = useState('wutai'); // 'wutai', 'ligu', 'all'
  const [target, setTarget] = useState('');
  const [location, setLocation] = useState('');
  const [desc, setDesc] = useState('');
  const [urgency, setUrgency] = useState('yellow');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail view update states
  const [newProgress, setNewProgress] = useState('');
  const [assignee, setAssignee] = useState('');
  const [isCustomAssignee, setIsCustomAssignee] = useState(false);
  const [customAssignee, setCustomAssignee] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Staff list for dynamic assignment (roles 0, 1, 2, 3, 40)
  const [staffList, setStaffList] = useState([]);

  // User info
  const lineUid = liffProfile?.userId || 'dev-admin';
  const isAdmin = canManageRepairs(staffData);
  const isSuper = isSuperAdmin(staffData);

  const fetchRepairs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (!lineUid) throw new Error('請先使用 LINE 登入再查看案件。');
      const response = await fetch('/api/repairs', {
        headers: { 'x-line-uid': lineUid }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '案件讀取失敗，請稍後重試。');
      setRepairs(data);
      if (isAdmin) {
        setRepairBadgeCount?.(data.filter(r => r.status !== 'closed').length);
      } else {
        setRepairBadgeCount?.(data.filter(r => r.status === 'completed' && r.reporter_uid === lineUid).length);
      }
    } catch (err) {
      setError(err.message);
      setRepairs([]);
    }
    setIsLoading(false);
  }, [lineUid, isAdmin, setRepairBadgeCount]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  // 若為具備管理權限人員，動態讀取可指派的教職員名單
  useEffect(() => {
    if (isAdmin && lineUid) {
      fetch('/api/staff', { headers: { 'x-line-uid': lineUid } })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) setStaffList(data);
        })
        .catch(() => {});
    }
  }, [isAdmin, lineUid]);

  // 篩選所有具備 0, 1, 2, 3, 40 角色之教職員
  const assignableStaff = staffList.filter(s => {
    const tags = roleTags(s);
    return isSuperAdmin(s) || ['1', '2', '3', '40'].some(t => tags.includes(t)) ||
      String(s.department || '').includes('總務');
  });

  const handleImageUpload = async (file) => {
    try {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1280, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from('repair_media').upload(fileName, compressedFile);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('repair_media').getPublicUrl(fileName);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('上傳失敗', error);
      throw new Error('照片上傳失敗，請重試後再送出表單。');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (!lineUid) throw new Error('請先使用 LINE 登入。');
      let uploadedUrls = [];
      for (const file of files) {
        const url = await handleImageUpload(file);
        if (url) uploadedUrls.push(url);
      }

      const campusPrefix = campus === 'ligu' ? '[勵古分校]' : campus === 'all' ? '[全校共通]' : '[霧臺校區]';
      const formattedLocation = `${campusPrefix} ${location.trim()}`;

      const response = await fetch('/api/repairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-uid': lineUid
        },
        body: JSON.stringify({
          type, target, location: formattedLocation, description: desc, urgency, media_urls: uploadedUrls
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '表單送出失敗');
      if (response.ok) {
        alert('✅ 送出成功！');
        setView('list');
        fetchRepairs();
        fetchRepairBadge?.(lineUid, staffData);
        // Reset form
        setTarget(''); setLocation(''); setDesc(''); setFiles([]); setUrgency('yellow'); setCampus('wutai');
      }
    } catch (err) {
      alert('送出失敗: ' + err.message);
    }
    setIsSubmitting(false);
  };

  const handleAddProgress = async () => {
    if (!newProgress.trim() || isUpdating) return;
    setIsUpdating(true);
    try {
      const authorName = staffData?.name || staffData?.title || '行政人員';
      const updatedLogs = [
        ...(selectedRepair.progress_logs || []),
        {
          time: new Date().toISOString(),
          author: authorName,
          text: newProgress.trim()
        }
      ];
      const saved = await updateRepair(selectedRepair.id, { progress_logs: updatedLogs });
      setSelectedRepair(saved);
      setNewProgress('');
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseCase = async () => {
    if (isUpdating) return;
    if (!window.confirm('確認修繕或採購已完成並結案？案件將移至歷史區。')) return;
    
    const authorName = `${selectedRepair.reporter_name || '原提報人'} (結案確認)`;
    const updatedLogs = [
      ...(selectedRepair.progress_logs || []),
      {
        time: new Date().toISOString(),
        author: authorName,
        text: closeNote.trim() || '確認成果無誤，已驗收結案'
      }
    ];

    const updates = { 
      status: 'closed', 
      urgency: 'blue',
      progress_logs: updatedLogs
    };
    setIsUpdating(true);
    try {
      const saved = await updateRepair(selectedRepair.id, updates);
      setSelectedRepair(saved);
      setShowHistory(true);
      setView('list');
      setCloseNote('');
      fetchRepairBadge?.(lineUid, staffData);
      alert('✅ 案件已結案！已移入歷史案件區。');
    } catch (err) {
      alert('結案失敗：' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveProcessing = async (completed = false) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const finalAssignee = isCustomAssignee
        ? (customAssignee.trim() || '其他人員')
        : (assignee || selectedRepair.assignee || '');
      
      const authorName = staffData?.name || staffData?.title || '承辦人員';
      const updatedLogs = [...(selectedRepair.progress_logs || [])];
      if (completed) {
        updatedLogs.push({
          time: new Date().toISOString(),
          author: authorName,
          text: `標記處理完成 (承辦人: ${finalAssignee || '未載明'})，等待原提報人確認結案`
        });
      }

      const updates = {
        assignee: finalAssignee,
        completion_details: { ...(selectedRepair.completion_details || {}), cost: completionCost },
        ...(completed ? { status: 'completed', progress_logs: updatedLogs } : {})
      };
      const saved = await updateRepair(selectedRepair.id, updates);
      setSelectedRepair(saved);
      fetchRepairBadge?.(lineUid, staffData);
      alert(completed ? '已標記處理完成，系統已提示原提報人確認結案。' : '處理資訊已儲存。');
    } catch (err) {
      alert('更新失敗：' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateRepair = async (id, updates) => {
    const response = await fetch('/api/repairs', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-line-uid': lineUid
      },
      body: JSON.stringify({ id, updates })
    });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || '案件更新失敗');
    if (!saved?.id) throw new Error('伺服器未回傳已儲存的案件，請重新確認狀態。');
    setRepairs(previous => {
      const next = previous.map(repair => repair.id === saved.id ? saved : repair);
      if (isAdmin) {
        setRepairBadgeCount?.(next.filter(r => r.status !== 'closed').length);
      } else {
        setRepairBadgeCount?.(next.filter(r => r.status === 'completed' && r.reporter_uid === lineUid).length);
      }
      return next;
    });
    return saved;
  };

  // Sort & Filter
  const sortedRepairs = [...repairs].sort((a, b) => {
    const urgencyWeight = { red: 1, yellow: 2, blue: 3 };
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return new Date(b.created_at) - new Date(a.created_at);
  }).filter(r => {
    if (filter !== 'all' && r.type !== filter) return false;
    if (showHistory ? r.status !== 'closed' : r.status === 'closed') return false;
    if (campusFilter !== 'all') {
      const info = parseRepairCampus(r.location);
      if (campusFilter === 'wutai' && info.key !== 'wutai') return false;
      if (campusFilter === 'ligu' && info.key !== 'ligu') return false;
      if (campusFilter === 'all_campus' && info.key !== 'all_campus') return false;
    }
    return true;
  });

  const pendingClosureCount = repairs.filter(r => r.status === 'completed' && r.reporter_uid === lineUid).length;
  const activeCasesCount = repairs.filter(r => r.status !== 'closed').length;
  const historyCasesCount = repairs.filter(r => r.status === 'closed').length;

  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6 pb-20">
      {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
      
      {/* 提報人有待結案案件時的頂部醒目橫幅 */}
      {view === 'list' && pendingClosureCount > 0 && (
        <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-200 text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 animate-ping flex-shrink-0"></span>
            <span>您有 <b>{pendingClosureCount}</b> 件案件已由總務處理完成，請確認品質並點擊結案</span>
          </div>
          <button 
            onClick={() => { setShowHistory(false); setFilter('all'); setCampusFilter('all'); }} 
            className="px-2.5 py-1 rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition active:scale-95 text-[11px] font-bold flex-shrink-0"
          >
            檢視
          </button>
        </div>
      )}

      {/* Header Tabs */}
      {view === 'list' && (
        <>
          <div className="flex justify-between items-center mb-4 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
                <Wrench size={16} />
              </div>
              <h2 className={`text-2xl font-black tracking-tight ${textColor}`}>線上報修與採購</h2>
            </div>
            <button 
              onClick={() => setView('form')} 
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl shadow-sm font-bold text-xs active:scale-95 transition"
            >
              <Plus size={15} />
              新增表單
            </button>
          </div>
          
          {/* 篩選標籤：進行中 vs 歷史案件 */}
          <div className="flex gap-2">
            <button 
              onClick={() => setShowHistory(false)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                !showHistory ? 'bg-emerald-700 text-white shadow-sm' : isDark ? 'bg-slate-800 text-stone-300' : 'bg-stone-200 text-stone-800'
              }`}
            >
              <span>進行中</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                !showHistory ? 'bg-white/20 text-white' : 'bg-stone-300 dark:bg-slate-700 text-stone-700 dark:text-stone-300'
              }`}>
                {activeCasesCount}
              </span>
            </button>
            <button 
              onClick={() => setShowHistory(true)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                showHistory ? 'bg-emerald-700 text-white shadow-sm' : isDark ? 'bg-slate-800 text-stone-300' : 'bg-stone-200 text-stone-800'
              }`}
            >
              <span>歷史案件</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                showHistory ? 'bg-white/20 text-white' : 'bg-stone-300 dark:bg-slate-700 text-stone-700 dark:text-stone-300'
              }`}>
                {historyCasesCount}
              </span>
            </button>
          </div>

          {/* 校區篩選按鈕列 */}
          <div className={`flex rounded-xl p-1 border gap-1 overflow-x-auto scrollbar-hide ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-stone-100 border-stone-200'}`}>
            {[
              { id: 'all', label: '全部校區' },
              { id: 'wutai', label: '霧臺校區' },
              { id: 'ligu', label: '勵古分校' },
              { id: 'all_campus', label: '全校共通' }
            ].map(c => (
              <button
                key={c.id}
                onClick={() => setCampusFilter(c.id)}
                className={`flex-1 min-w-[72px] py-1.5 rounded-lg text-xs font-bold transition text-center ${
                  campusFilter === c.id
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : `${isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900'}`
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* 案件類型篩選 */}
          <div className={`flex rounded-xl p-1 border gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-stone-100 border-stone-200'}`}>
            <button 
              onClick={() => setFilter('all')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'all' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : `${isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900'}`
              }`}
            >
              全部類型
            </button>
            <button 
              onClick={() => setFilter('repair')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                filter === 'repair' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : `${isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900'}`
              }`}
            >
              <Wrench size={13} />
              報修
            </button>
            <button 
              onClick={() => setFilter('purchase')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                filter === 'purchase' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : `${isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900'}`
              }`}
            >
              <ShoppingCart size={13} />
              採購
            </button>
          </div>

          {/* 列表清單 */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center py-8 text-emerald-700 font-bold animate-pulse text-sm">載入案件中...</p>
            ) : sortedRepairs.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-stone-200 bg-stone-50/50'}`}>
                <p className={subTextColor}>目前沒有符合條件的提報案件</p>
              </div>
            ) : null}

            {sortedRepairs.map(r => {
              const campusInfo = parseRepairCampus(r.location);
              return (
                <div 
                  key={r.id} 
                  onClick={() => { 
                    setSelectedRepair(r); 
                    setAssignee(r.assignee || ''); 
                    setIsCustomAssignee(false);
                    setCustomAssignee('');
                    setCompletionCost(r.completion_details?.cost ?? ''); 
                    setNewProgress(''); 
                    setCloseNote('');
                    setView('detail'); 
                  }}
                  className={`p-4 rounded-2xl shadow-sm cursor-pointer border-l-4 transition-all hover:scale-[1.01] active:scale-[0.99] border ${
                    cardBg
                  } ${
                    r.urgency === 'red' 
                      ? 'border-l-red-500' 
                      : r.urgency === 'yellow' 
                        ? 'border-l-amber-400' 
                        : 'border-l-sky-500 opacity-80'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        r.type === 'repair' 
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {r.type === 'repair' ? <Wrench size={14} /> : <ShoppingCart size={14} />}
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${campusInfo.badgeClass}`}>
                        {campusInfo.label}
                      </span>
                      <h3 className={`font-extrabold text-base ${textColor}`}>{r.target}</h3>
                    </div>
                    <span className={`text-[11px] font-bold flex-shrink-0 ${subTextColor}`}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className={`text-xs mb-3 truncate flex items-center gap-1 ${subTextColor}`}>
                    <MapPin size={12} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-stone-700 dark:text-stone-300">{campusInfo.cleanLocation}</span>
                    <span className="opacity-40">|</span>
                    <span className="truncate">{r.description}</span>
                  </p>
                  <div className="flex justify-between items-center text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                      r.status === 'closed' 
                        ? 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' 
                        : r.status === 'completed'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                          : 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:border-slate-700'
                    }`}>
                      {r.status === 'closed' ? '已結案' : r.status === 'completed' ? '待提報人確認' : `處理人員: ${r.assignee || '待排派'}`}
                    </span>
                    <span className={`text-[11px] font-bold ${subTextColor}`}>{r.reporter_name} 提報</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Form View */}
      {view === 'form' && (
        <div className={`p-6 rounded-2xl shadow-xl border ${cardBg}`}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className={`text-2xl font-black ${textColor}`}>填寫申請表單</h2>
            </div>
            <button 
              onClick={() => setView('list')} 
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                isDark ? 'bg-slate-800 border-slate-700 text-stone-300 hover:bg-slate-700' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <X size={14} />
              取消
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. 報修 vs 採購切換 */}
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setType('repair')} 
                className={`flex-1 py-3 rounded-xl font-extrabold text-sm border-2 transition flex items-center justify-center gap-2 ${
                  type === 'repair' 
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500' 
                    : `${isDark ? 'border-slate-700 text-stone-400 bg-slate-800/40' : 'border-stone-200 text-stone-500 bg-stone-50'}`
                }`}
              >
                <Wrench size={16} />
                我要報修
              </button>
              <button 
                type="button" 
                onClick={() => setType('purchase')} 
                className={`flex-1 py-3 rounded-xl font-extrabold text-sm border-2 transition flex items-center justify-center gap-2 ${
                  type === 'purchase' 
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500' 
                    : `${isDark ? 'border-slate-700 text-stone-400 bg-slate-800/40' : 'border-stone-200 text-stone-500 bg-stone-50'}`
                }`}
              >
                <ShoppingCart size={16} />
                我要採購
              </button>
            </div>

            {/* 2. 所屬校區選擇 (霧臺校區 / 勵古分校 / 全校共通) */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>所屬校區</label>
              <div className="flex gap-2">
                {[
                  { id: 'wutai', label: '霧臺校區' },
                  { id: 'ligu', label: '勵古分校' },
                  { id: 'all', label: '全校共通' }
                ].map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCampus(c.id)}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition ${
                      campus === c.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500 shadow-xs'
                        : `${isDark ? 'border-slate-700 text-stone-400 bg-slate-800/40' : 'border-stone-200 text-stone-500 bg-stone-50'}`
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 標的物 */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>標的物 (例：三年甲班冷氣、印表機碳粉)</label>
              <input 
                required 
                value={target} 
                onChange={e=>setTarget(e.target.value)} 
                className={`w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-stone-50 border-stone-300 text-stone-900'
                }`}
                placeholder="請輸入標的物" 
              />
            </div>

            {/* 4. 所在位置 */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>所在具體位置</label>
              <input 
                required 
                value={location} 
                onChange={e=>setLocation(e.target.value)} 
                className={`w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-stone-50 border-stone-300 text-stone-900'
                }`}
                placeholder="例：三年甲班教室、總務處辦公室" 
              />
            </div>

            {/* 5. 狀況簡述 */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>狀況簡述</label>
              <textarea 
                required 
                value={desc} 
                onChange={e=>setDesc(e.target.value)} 
                className={`w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-stone-50 border-stone-300 text-stone-900'
                }`}
                rows={3} 
                placeholder="請簡短描述損壞情形或採購原因" 
              />
            </div>
            
            {/* 6. 緊急程度 */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>緊急程度</label>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setUrgency('yellow')} 
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition flex items-center justify-center gap-1.5 ${
                    urgency === 'yellow' 
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' 
                      : `${isDark ? 'border-slate-700 text-stone-400' : 'border-stone-200 text-stone-500'}`
                  }`}
                >
                  <Clock size={14} className="text-amber-500" />
                  一般案件
                </button>
                <button 
                  type="button" 
                  onClick={() => setUrgency('red')} 
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition flex items-center justify-center gap-1.5 ${
                    urgency === 'red' 
                      ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200' 
                      : `${isDark ? 'border-slate-700 text-stone-400' : 'border-stone-200 text-stone-500'}`
                  }`}
                >
                  <AlertTriangle size={14} className="text-red-500" />
                  緊急處理
                </button>
              </div>
            </div>

            {/* 7. 照片上傳 */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor} flex items-center gap-1.5`}>
                <Camera size={14} className="text-emerald-600 dark:text-emerald-400" />
                上傳照片 (選填，自動壓縮節省空間)
              </label>
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                onChange={(e) => setFiles(Array.from(e.target.files))} 
                className={`w-full p-2 border rounded-xl text-xs ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-300' : 'bg-stone-50 border-stone-300 text-stone-700'
                }`} 
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3.5 rounded-xl shadow-lg mt-6 transition active:scale-[0.99] disabled:bg-stone-400"
            >
              {isSubmitting ? '上傳中...' : '送出表單'}
            </button>
          </form>
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedRepair && (
        <div className={`rounded-2xl shadow-xl overflow-hidden border ${cardBg}`}>
          {/* 案件基本卡片頭部 */}
          <div className={`p-6 border-b-4 ${
            selectedRepair.urgency === 'red' 
              ? 'border-b-red-500' 
              : selectedRepair.urgency === 'yellow' 
                ? 'border-b-amber-400' 
                : 'border-b-sky-500'
          }`}>
            <div className="flex justify-between items-start mb-4 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  selectedRepair.type === 'repair' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {selectedRepair.type === 'repair' ? <Wrench size={16} /> : <ShoppingCart size={16} />}
                </div>
                {(() => {
                  const info = parseRepairCampus(selectedRepair.location);
                  return (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${info.badgeClass}`}>
                      {info.label}
                    </span>
                  );
                })()}
                <h2 className={`text-xl font-black ${textColor}`}>{selectedRepair.target}</h2>
              </div>
              <button 
                onClick={() => setView('list')} 
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-300 hover:bg-slate-700' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <ArrowLeft size={14} />
                返回列表
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <p className={subTextColor}>
                <MapPin size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" />
                <b className={textColor}>位置:</b> {parseRepairCampus(selectedRepair.location).cleanLocation}
              </p>
              <p className={subTextColor}><User size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /><b className={textColor}>提報人:</b> {selectedRepair.reporter_name}</p>
              <p className={subTextColor}><Calendar size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /><b className={textColor}>日期:</b> {new Date(selectedRepair.created_at).toLocaleDateString()}</p>
              <p className={subTextColor}><CheckCircle2 size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /><b className={textColor}>狀態:</b> {selectedRepair.status === 'closed' ? '已結案' : selectedRepair.status === 'completed' ? '待提報人確認' : '處理中'}</p>
            </div>

            <div className={`p-4 rounded-xl text-sm leading-relaxed ${isDark ? 'bg-slate-800/80 text-stone-200' : 'bg-stone-100 text-stone-800'}`}>
              {selectedRepair.description}
            </div>
            
            {/* 照片藝廊 */}
            {selectedRepair.media_urls && selectedRepair.media_urls.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {selectedRepair.media_urls.map((url, i) => (
                  <img key={i} src={url} alt="附件" className="h-24 w-24 object-cover rounded-xl shadow-sm border border-stone-200 dark:border-slate-700" />
                ))}
              </div>
            )}
          </div>

          {/* 處理進度區 (歷程紀錄 - 包含操作人員與時間序列) */}
          <div className={`p-6 border-b border-stone-200 dark:border-slate-800 ${isDark ? 'bg-slate-950/40' : 'bg-stone-50/60'}`}>
            <h3 className={`font-black text-base mb-4 flex items-center gap-1.5 ${textColor}`}>
              <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
              處理歷程
            </h3>
            <div className="space-y-2.5 mb-4 max-h-56 overflow-y-auto scrollbar-hide">
              {(!selectedRepair.progress_logs || selectedRepair.progress_logs.length === 0) && (
                <p className={`text-xs italic py-1 ${subTextColor}`}>尚無處理紀錄</p>
              )}
              {(selectedRepair.progress_logs || []).map((log, i) => (
                <div key={i} className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
                  isDark ? 'bg-slate-800/80 border-slate-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'
                }`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <User size={12} />
                      {log.author || '行政同仁'}
                    </span>
                    <span className="text-stone-400 font-mono text-[10px]">
                      {log.time ? new Date(log.time).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-200">{log.text}</p>
                </div>
              ))}
            </div>
            
            {/* 新增進度輸入框 (限管理與承辦人員) */}
            {selectedRepair.status !== 'closed' && isAdmin && (
              <div className="flex gap-2">
                <input 
                  value={newProgress} 
                  onChange={e=>setNewProgress(e.target.value)} 
                  className={`flex-1 p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                  }`} 
                  placeholder="新增處理進度說明..." 
                />
                <button 
                  onClick={handleAddProgress} 
                  disabled={isUpdating || !newProgress.trim()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 flex-shrink-0 disabled:bg-stone-400"
                >
                  送出
                </button>
              </div>
            )}
          </div>

          {/* 行政處理專區 (指派 0,1,2,3,40 或自訂其他，填報金額並標記完成) */}
          {isAdmin && selectedRepair.status !== 'closed' && (
            <div className={`p-6 border-t ${isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <h3 className={`font-black text-base mb-4 flex items-center gap-1.5 ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
                <Settings size={16} />
                行政處理專區
              </h3>
              <div className="space-y-3.5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2 items-center">
                    <label className={`text-xs font-bold w-20 ${textColor}`}>處理人員</label>
                    <select 
                      value={isCustomAssignee ? '__custom__' : (assignee || selectedRepair.assignee || '')} 
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomAssignee(true);
                        } else {
                          setIsCustomAssignee(false);
                          setAssignee(e.target.value);
                        }
                      }} 
                      className={`flex-1 p-2.5 border rounded-xl text-xs outline-none ${
                        isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                      }`}
                    >
                      <option value="">請選擇承辦人員</option>
                      {assignableStaff.length > 0 ? (
                        assignableStaff.map(s => {
                          const roleLabel = `${s.name}${s.title ? ` (${s.title})` : (s.department ? ` (${s.department})` : '')}`;
                          return <option key={s.id || s.email} value={roleLabel}>{roleLabel}</option>;
                        })
                      ) : (
                        <>
                          <option value="總務主任">總務主任</option>
                          <option value="事務組長">事務組長</option>
                          <option value="出納組長">出納組長</option>
                          <option value="文書組長">文書組長</option>
                          <option value="總務處同仁">總務處同仁</option>
                          <option value="教務主任">教務主任</option>
                          <option value="學務主任">學務主任</option>
                          <option value="校長">校長</option>
                        </>
                      )}
                      <option value="__custom__">其他（自訂輸入／委外廠商）</option>
                    </select>
                  </div>

                  {/* 選擇「其他」時展開自訂輸入框 */}
                  {isCustomAssignee && (
                    <div className="flex gap-2 items-center pl-22 animate-fade-in">
                      <input 
                        type="text" 
                        value={customAssignee} 
                        onChange={e => setCustomAssignee(e.target.value)} 
                        placeholder="請輸入承辦人姓名或外包廠商（例：大同水電行、日立冷氣）" 
                        className={`flex-1 p-2.5 border rounded-xl text-xs outline-none ${
                          isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <label className={`text-xs font-bold w-20 ${textColor}`}>總金額 ($)</label>
                  <input 
                    type="number" 
                    value={completionCost} 
                    onChange={e=>setCompletionCost(e.target.value)} 
                    className={`flex-1 p-2.5 border rounded-xl text-xs outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                    }`} 
                    placeholder="如無支出則免填" 
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <button 
                    onClick={() => handleSaveProcessing(false)}
                    disabled={isUpdating}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5 text-xs"
                  >
                    <CheckCircle2 size={15} />
                    儲存承辦與處理資訊
                  </button>
                  {selectedRepair.status !== 'completed' && (
                    <button 
                      onClick={() => handleSaveProcessing(true)} 
                      disabled={isUpdating} 
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl shadow-xs transition active:scale-[0.99] text-xs flex items-center justify-center gap-1.5"
                    >
                      <Check size={15} />
                      標記處理完成（通知原提報人確認結案）
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 原提報人確認結案專區 (含可選填結案備註) */}
          {selectedRepair.status === 'completed' && (selectedRepair.reporter_uid === lineUid || isSuper) && (
            <div className="p-6 bg-sky-50/90 dark:bg-slate-800 border-t border-sky-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200 font-extrabold text-sm">
                <CheckCircle2 size={18} className="text-sky-600 dark:text-sky-400" />
                <span>承辦人員已標記處理完成，請確認成果</span>
              </div>
              <p className={`text-xs ${textColor}`}>請實地確認修繕或採購結果；驗收確認無誤後即可點選結案歸檔。</p>
              <div>
                <label className={`block text-xs font-bold mb-1 ${textColor}`}>驗收結案備註（選填）</label>
                <input 
                  type="text" 
                  value={closeNote} 
                  onChange={e => setCloseNote(e.target.value)} 
                  placeholder="例：冷氣運轉冷度正常，感謝總務處！" 
                  className={`w-full p-2.5 border rounded-xl text-xs outline-none ${
                    isDark ? 'bg-slate-900 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                  }`}
                />
              </div>
              <button 
                onClick={handleCloseCase} 
                disabled={isUpdating} 
                className="w-full bg-sky-700 hover:bg-sky-800 active:scale-[0.99] text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                確認完成並結案（移入歷史區）
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
