import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';
import liff from '@line/liff';
import { useApp } from '../App';
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
  UploadCloud 
} from 'lucide-react';

export default function RepairDashboard() {
  const { isDark } = useApp();
  const [view, setView] = useState('list'); // 'list', 'form', 'detail'
  const [filter, setFilter] = useState('all'); // 'all', 'repair', 'purchase'
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
  const [vendorInfo, setVendorInfo] = useState({ name: '', contact: '', phone: '' });
  const [completionCost, setCompletionCost] = useState('');
  
  // User info
  const [lineUid, setLineUid] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // 總務處或行政可以編輯進度

  useEffect(() => {
    fetchRepairs();
  }, []);

  const fetchRepairs = async () => {
    setIsLoading(true);
    try {
      let uid = 'dev-admin';
      if (window.liff?.isLoggedIn()) {
        const profile = await window.liff.getProfile();
        uid = profile.userId;
      }
      setLineUid(uid);

      // Check role just for UI rendering purposes
      const { data: staff } = await supabase.from('staff').select('*').eq('line_uid', uid).single();
      setIsAdmin(staff && (staff.title === '行政' || staff.email.includes('u864001')));

      const response = await fetch('/api/repairs', {
        headers: { 'x-line-uid': uid }
      });
      const data = await response.json();
      if (response.ok) {
        setRepairs(data);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleImageUpload = async (file) => {
    try {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1280, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { data, error } = await supabase.storage.from('repair_media').upload(fileName, compressedFile);
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('repair_media').getPublicUrl(fileName);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('上傳失敗', error);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
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

      if (response.ok) {
        alert('✅ 送出成功！');
        setView('list');
        fetchRepairs();
        // Reset form
        setTarget(''); setLocation(''); setDesc(''); setFiles([]);
      }
    } catch (err) {
      alert('送出失敗: ' + err.message);
    }
    setIsSubmitting(false);
  };

  const handleAddProgress = async () => {
    if (!newProgress) return;
    const updatedLogs = [...(selectedRepair.progress_logs || []), { time: new Date().toISOString(), text: newProgress }];
    await updateRepair(selectedRepair.id, { progress_logs: updatedLogs });
    setSelectedRepair({ ...selectedRepair, progress_logs: updatedLogs });
    setNewProgress('');
  };

  const handleCloseCase = async () => {
    if (!window.confirm('確定要結案嗎？結案後將無法再修改。')) return;
    const updates = { 
      status: 'closed', 
      urgency: 'blue',
      assignee: assignee || selectedRepair.assignee,
      vendor_info: vendorInfo,
      completion_details: { time: new Date().toISOString(), cost: completionCost }
    };
    await updateRepair(selectedRepair.id, updates);
    setSelectedRepair({ ...selectedRepair, ...updates });
    alert('✅ 案件已結案！');
  };

  const updateRepair = async (id, updates) => {
    await fetch('/api/repairs', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-line-uid': lineUid
      },
      body: JSON.stringify({ id, updates })
    });
    fetchRepairs();
  };

  // Sort: Red -> Yellow -> Blue (Closed)
  const sortedRepairs = [...repairs].sort((a, b) => {
    const urgencyWeight = { red: 1, yellow: 2, blue: 3 };
    if (urgencyWeight[a.urgency] !== urgencyWeight[b.urgency]) {
      return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
    }
    return new Date(b.created_at) - new Date(a.created_at);
  }).filter(r => filter === 'all' ? true : r.type === filter);

  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6 pb-20">
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
                onClick={() => { setSelectedRepair(r); setView('detail'); }}
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
              <p className={subTextColor}><CheckCircle2 size={13} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /><b className={textColor}>狀態:</b> {selectedRepair.status === 'closed' ? '已結案' : '處理中'}</p>
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
            {selectedRepair.status !== 'closed' && (isAdmin || selectedRepair.reporter_uid === lineUid) && (
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
                  onClick={handleCloseCase} 
                  className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-3 rounded-xl shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  結案並轉為藍燈
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
