import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';
import liff from '@line/liff';

export default function RepairDashboard() {
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
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
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

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      {/* Header Tabs */}
      {view === 'list' && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">🏫 線上報修與採購</h2>
            <button onClick={() => setView('form')} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-bold">
              + 新增表單
            </button>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setFilter('all')} className={`flex-1 py-2 rounded-lg font-bold ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>全部案件</button>
            <button onClick={() => setFilter('repair')} className={`flex-1 py-2 rounded-lg font-bold ${filter === 'repair' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>🛠️ 報修</button>
            <button onClick={() => setFilter('purchase')} className={`flex-1 py-2 rounded-lg font-bold ${filter === 'purchase' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}>🛒 採購</button>
          </div>

          <div className="space-y-3">
            {isLoading ? <p>載入中...</p> : sortedRepairs.length === 0 ? <p className="text-gray-500">目前沒有案件。</p> : null}
            {sortedRepairs.map(r => (
              <div 
                key={r.id} 
                onClick={() => { setSelectedRepair(r); setView('detail'); }}
                className={`p-4 rounded-xl shadow cursor-pointer border-l-8 transition-transform hover:scale-[1.01] bg-white ${r.urgency === 'red' ? 'border-red-500' : r.urgency === 'yellow' ? 'border-yellow-400' : 'border-blue-500 opacity-75'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{r.type === 'repair' ? '🛠️' : '🛒'}</span>
                    <h3 className="font-bold text-lg text-gray-800">{r.target}</h3>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2 truncate">📍 {r.location} | {r.description}</p>
                <div className="flex justify-between items-center text-xs">
                  <span className={`px-2 py-1 rounded-full font-bold ${r.status === 'closed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    處理人員: {r.assignee || '待排派'}
                  </span>
                  <span className="text-gray-400 font-bold">{r.reporter_name} 提報</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form View */}
      {view === 'form' && (
        <div className="bg-white p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📝 填寫表單</h2>
            <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-800 font-bold">✕ 取消</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 text-gray-800">
            <div className="flex gap-2">
              <button type="button" onClick={() => setType('repair')} className={`flex-1 py-3 rounded-lg font-bold border-2 ${type === 'repair' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>🛠️ 我要報修</button>
              <button type="button" onClick={() => setType('purchase')} className={`flex-1 py-3 rounded-lg font-bold border-2 ${type === 'purchase' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>🛒 我要採購</button>
            </div>
            <div><label className="block text-sm font-bold mb-1">標的物 (例：三年甲班冷氣、印表機碳粉)</label><input required value={target} onChange={e=>setTarget(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="請輸入標的物" /></div>
            <div><label className="block text-sm font-bold mb-1">所在位置</label><input required value={location} onChange={e=>setLocation(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="例：三年甲班教室、教務處" /></div>
            <div><label className="block text-sm font-bold mb-1">狀況簡述</label><textarea required value={desc} onChange={e=>setDesc(e.target.value)} className="w-full p-3 border rounded-lg" rows="3" placeholder="請簡短描述損壞情形或採購原因" /></div>
            
            <div>
              <label className="block text-sm font-bold mb-1">緊急程度</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setUrgency('yellow')} className={`flex-1 py-2 rounded-lg font-bold border-2 ${urgency === 'yellow' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'}`}>🟡 一般案件</button>
                <button type="button" onClick={() => setUrgency('red')} className={`flex-1 py-2 rounded-lg font-bold border-2 ${urgency === 'red' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>🔴 緊急處理</button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">📸 上傳照片 (選填，自動壓縮節省空間)</label>
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="w-full p-2 border rounded-lg" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg mt-6">
              {isSubmitting ? '上傳中...' : '送出表單'}
            </button>
          </form>
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedRepair && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden text-gray-800">
          <div className={`p-6 border-b-8 ${selectedRepair.urgency === 'red' ? 'border-red-500' : selectedRepair.urgency === 'yellow' ? 'border-yellow-400' : 'border-blue-500 bg-gray-50'}`}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold">{selectedRepair.type === 'repair' ? '🛠️ 報修單' : '🛒 採購單'}: {selectedRepair.target}</h2>
              <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-800 font-bold bg-gray-200 px-3 py-1 rounded">返回</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <p>📍 <b>位置:</b> {selectedRepair.location}</p>
              <p>👤 <b>提報人:</b> {selectedRepair.reporter_name}</p>
              <p>📅 <b>日期:</b> {new Date(selectedRepair.created_at).toLocaleDateString()}</p>
              <p>📌 <b>狀態:</b> {selectedRepair.status === 'closed' ? '🔵 已結案' : '處理中'}</p>
            </div>
            <p className="bg-gray-100 p-4 rounded-lg">{selectedRepair.description}</p>
            
            {/* 照片藝廊 */}
            {selectedRepair.media_urls && selectedRepair.media_urls.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {selectedRepair.media_urls.map((url, i) => (
                  <img key={i} src={url} alt="附件" className="h-24 w-24 object-cover rounded-lg shadow-sm border" />
                ))}
              </div>
            )}
          </div>

          {/* 處理進度區 (歷程紀錄) */}
          <div className="p-6 bg-gray-50 border-b">
            <h3 className="font-bold text-lg mb-4">📝 處理歷程</h3>
            <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
              {(!selectedRepair.progress_logs || selectedRepair.progress_logs.length === 0) && <p className="text-gray-400 text-sm">尚無處理紀錄</p>}
              {(selectedRepair.progress_logs || []).map((log, i) => (
                <div key={i} className="bg-white p-3 rounded shadow-sm border text-sm flex gap-3">
                  <span className="text-gray-400 w-12 flex-shrink-0">{new Date(log.time).toLocaleDateString().slice(5)}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
            
            {/* 新增進度輸入框 (僅開放且是 Admin 時可操作，或是自己也能補充) */}
            {selectedRepair.status !== 'closed' && (isAdmin || selectedRepair.reporter_uid === lineUid) && (
              <div className="flex gap-2">
                <input value={newProgress} onChange={e=>setNewProgress(e.target.value)} className="flex-1 p-2 border rounded text-sm" placeholder="新增進度說明..." />
                <button onClick={handleAddProgress} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold">送出</button>
              </div>
            )}
          </div>

          {/* 總務處維修專區 (結案操作) */}
          {isAdmin && selectedRepair.status !== 'closed' && (
            <div className="p-6 bg-blue-50">
              <h3 className="font-bold text-lg text-blue-800 mb-4">⚙️ 行政處理專區</h3>
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-bold w-20">處理人員</label>
                  <select value={assignee || selectedRepair.assignee || ''} onChange={e=>setAssignee(e.target.value)} className="flex-1 p-2 border rounded">
                    <option value="">請選擇</option>
                    <option value="陳婷婕">陳婷婕</option>
                    <option value="楊千儀">楊千儀</option>
                    <option value="其他總務人員">其他</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-sm font-bold w-20">總金額 ($)</label>
                  <input type="number" value={completionCost} onChange={e=>setCompletionCost(e.target.value)} className="flex-1 p-2 border rounded" placeholder="如無則免填" />
                </div>
                <button onClick={handleCloseCase} className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow">
                  ✅ 結案並轉為藍燈
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
