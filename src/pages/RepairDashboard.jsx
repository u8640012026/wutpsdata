import React, { useState, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';
import { useApp } from '../App';
import { canManageRepairs, isSuperAdmin } from '../lib/staffAccess';
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
  Settings
} from 'lucide-react';

export default function RepairDashboard() {
  const { isDark, setHideBottomNav, liffProfile, staffData } = useApp();
  const [view, setView] = useState('list'); // 'list', 'form', 'detail'

  // 填報表單或檢視詳情時自動隱藏底部導覽列
  useEffect(() => {
    setHideBottomNav?.(view !== 'list');
    return () => setHideBottomNav?.(false);
  }, [view, setHideBottomNav]);
  const [filter, setFilter] = useState('all'); // 'all', 'repair', 'purchase'
  const [showHistory, setShowHistory] = useState(false);
  const [repairs, setRepairs] = useState([]);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [type, setType] = useState('repair');
  const [target, setTarget] = useState('');
  const [location, setLocation] = useState('');
  const [desc, setDesc] = useState('');
  const [urgency, setUrgency] = useState('yellow');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail view update states
  const [newProgress, setNewProgress] = useState('');
  const [assignee, setAssignee] = useState('');
  const [completionCost, setCompletionCost] = useState('');
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // User info
  const lineUid = liffProfile?.userId;
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
    } catch (err) {
      setError(err.message);
      setRepairs([]);
    }
    setIsLoading(false);
  }, [lineUid]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

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

      const response = await fetch('/api/repairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-uid': lineUid
        },
        body: JSON.stringify({
          type, target, location, description: desc, urgency, media_urls: uploadedUrls
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '表單送出失敗');
      if (response.ok) {
        alert('✅ 送出成功！');
        setView('list');
        fetchRepairs();
        // Reset form
        setTarget(''); setLocation(''); setDesc(''); setFiles([]); setUrgency('yellow');
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
      const updatedLogs = [...(selectedRepair.progress_logs || []), { time: new Date().toISOString(), text: newProgress.trim() }];
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
    const updates = { 
      status: 'closed', 
      urgency: 'blue',
    };
    setIsUpdating(true);
    try {
      const saved = await updateRepair(selectedRepair.id, updates);
      setSelectedRepair(saved);
      setShowHistory(true);
      setView('list');
      alert('✅ 案件已結案！');
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
      const updates = {
        assignee,
        completion_details: { ...(selectedRepair.completion_details || {}), cost: completionCost },
        ...(completed ? { status: 'completed' } : {})
      };
      const saved = await updateRepair(selectedRepair.id, updates);
      setSelectedRepair(saved);
      alert(completed ? '已標記處理完成，請由原提報人確認結案。' : '處理資訊已儲存。');
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
    setRepairs(previous => previous.map(repair => repair.id === saved.id ? saved : repair));
    return saved;
  };

  // Sort: Red -> Yellow -> Blue (Closed)
  const sortedRepairs = [...repairs].sort((a, b) => {
    const urgencyWeight = { red: 1, yellow: 2, blue: 3 };
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return new Date(b.created_at) - new Date(a.created_at);
  }).filter(r => (filter === 'all' || r.type === filter) && (showHistory ? r.status === 'closed' : r.status !== 'closed'));

  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6 pb-20">
      {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
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
          
          {/* 篩選標籤 */}
          <div className="flex gap-2">
            <button onClick={() => setShowHistory(false)} className={`px-4 py-2 rounded-xl ${!showHistory ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-800'}`}>進行中</button>
            <button onClick={() => setShowHistory(true)} className={`px-4 py-2 rounded-xl ${showHistory ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-800'}`}>歷史案件</button>
          </div>
          <div className={`flex rounded-xl p-1 border gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-stone-100 border-stone-200'}`}>
            <button 
              onClick={() => setFilter('all')} 
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'all' 
                  ? 'bg-emerald-700 text-white shadow-sm' 
                  : `${isDark ? 'text-stone-400 hover:text-stone-200' : 'text-stone-600 hover:text-stone-900'}`
              }`}
            >
              全部案件
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

          {/* 列表 */}
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center py-8 text-emerald-700 font-bold animate-pulse text-sm">載入案件中...</p>
            ) : sortedRepairs.length === 0 ? (
              <div className={`p-8 text-center rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-stone-200 bg-stone-50/50'}`}>
                <p className={subTextColor}>目前沒有提報案件</p>
              </div>
            ) : null}

            {sortedRepairs.map(r => (
              <div 
                key={r.id} 
                onClick={() => { setSelectedRepair(r); setAssignee(r.assignee || ''); setCompletionCost(r.completion_details?.cost ?? ''); setNewProgress(''); setView('detail'); }}
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
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      r.type === 'repair' 
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {r.type === 'repair' ? <Wrench size={14} /> : <ShoppingCart size={14} />}
                    </div>
                    <h3 className={`font-extrabold text-base ${textColor}`}>{r.target}</h3>
                  </div>
                  <span className={`text-[11px] font-bold ${subTextColor}`}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className={`text-xs mb-3 truncate flex items-center gap-1 ${subTextColor}`}>
                  <MapPin size={12} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{r.location}</span>
                  <span className="opacity-40">|</span>
                  <span className="truncate">{r.description}</span>
                </p>
                <div className="flex justify-between items-center text-xs">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                    r.status === 'closed' 
                      ? 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800' 
                      : 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-slate-800 dark:text-stone-300 dark:border-slate-700'
                  }`}>
                    處理人員: {r.assignee || '待排派'}
                  </span>
                  <span className={`text-[11px] font-bold ${subTextColor}`}>{r.reporter_name} 提報</span>
                </div>
              </div>
            ))}
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

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textColor}`}>所在位置</label>
              <input 
                required 
                value={location} 
                onChange={e=>setLocation(e.target.value)} 
                className={`w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-stone-50 border-stone-300 text-stone-900'
                }`}
                placeholder="例：三年甲班教室、教務處" 
              />
            </div>

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
          <div className={`p-6 border-b-4 ${
            selectedRepair.urgency === 'red' 
              ? 'border-b-red-500' 
              : selectedRepair.urgency === 'yellow' 
                ? 'border-b-amber-400' 
                : 'border-b-sky-500'
          }`}>
            <div className="flex justify-between items-start mb-4 gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedRepair.type === 'repair' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {selectedRepair.type === 'repair' ? <Wrench size={16} /> : <ShoppingCart size={16} />}
                </div>
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
              <p className={subTextColor}><MapPin size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /><b className={textColor}>位置:</b> {selectedRepair.location}</p>
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

          {/* 處理進度區 (歷程紀錄) */}
          <div className={`p-6 border-b border-stone-200 dark:border-slate-800 ${isDark ? 'bg-slate-950/40' : 'bg-stone-50/60'}`}>
            <h3 className={`font-black text-base mb-4 flex items-center gap-1.5 ${textColor}`}>
              <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />
              處理歷程
            </h3>
            <div className="space-y-2.5 mb-4 max-h-40 overflow-y-auto scrollbar-hide">
              {(!selectedRepair.progress_logs || selectedRepair.progress_logs.length === 0) && (
                <p className={`text-xs italic py-1 ${subTextColor}`}>尚無處理紀錄</p>
              )}
              {(selectedRepair.progress_logs || []).map((log, i) => (
                <div key={i} className={`p-3 rounded-xl border text-xs flex gap-3 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'
                }`}>
                  <span className="text-stone-400 w-12 flex-shrink-0 font-mono">{new Date(log.time).toLocaleDateString().slice(5)}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
            
            {/* 新增進度輸入框 */}
            {selectedRepair.status !== 'closed' && isAdmin && (
              <div className="flex gap-2">
                <input 
                  value={newProgress} 
                  onChange={e=>setNewProgress(e.target.value)} 
                  className={`flex-1 p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                  }`} 
                  placeholder="新增進度說明..." 
                />
                <button 
                  onClick={handleAddProgress} 
                  disabled={isUpdating || !newProgress.trim()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 flex-shrink-0"
                >
                  送出
                </button>
              </div>
            )}
          </div>

          {/* 總務處維修專區 (結案操作) */}
          {isAdmin && selectedRepair.status !== 'closed' && (
            <div className={`p-6 border-t ${isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <h3 className={`font-black text-base mb-4 flex items-center gap-1.5 ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
                <Settings size={16} />
                行政處理專區
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <label className={`text-xs font-bold w-20 ${textColor}`}>處理人員</label>
                  <select 
                    value={assignee || selectedRepair.assignee || ''} 
                    onChange={e=>setAssignee(e.target.value)} 
                    className={`flex-1 p-2 border rounded-xl text-xs outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  >
                    <option value="">請選擇</option>
                    <option value="陳婷婕">陳婷婕</option>
                    <option value="楊千儀">楊千儀</option>
                    <option value="其他總務人員">其他</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <label className={`text-xs font-bold w-20 ${textColor}`}>總金額 ($)</label>
                  <input 
                    type="number" 
                    value={completionCost} 
                    onChange={e=>setCompletionCost(e.target.value)} 
                    className={`flex-1 p-2 border rounded-xl text-xs outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'
                    }`} 
                    placeholder="如無則免填" 
                  />
                </div>
                <button 
                  onClick={() => handleSaveProcessing(false)}
                  disabled={isUpdating}
                  className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  儲存處理資訊
                </button>
                {selectedRepair.status !== 'completed' && <button onClick={() => handleSaveProcessing(true)} disabled={isUpdating} className="w-full bg-emerald-700 text-white font-bold py-3 rounded-xl">標記處理完成</button>}
              </div>
            </div>
          )}
          {selectedRepair.status === 'completed' && (selectedRepair.reporter_uid === lineUid || isSuper) && (
            <div className="p-6 bg-sky-50 dark:bg-slate-800">
              <p className={`mb-3 text-sm ${textColor}`}>請確認修繕或採購結果；仍有問題請聯繫承辦人。</p>
              <button onClick={handleCloseCase} disabled={isUpdating} className="w-full bg-sky-700 text-white font-bold py-3 rounded-xl">確認完成並結案</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
