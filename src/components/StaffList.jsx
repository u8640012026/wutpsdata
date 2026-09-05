import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import liff from '@line/liff';
import { Check, X, ShieldCheck } from 'lucide-react';

export default function StaffList() {
  const { isDark } = useApp();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState('dev-admin');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      let uid = 'dev-admin';
      if (window.liff?.isLoggedIn()) {
        const profile = await window.liff.getProfile();
        uid = profile.userId;
      }
      setCurrentUid(uid);

      const response = await fetch('/api/staff', {
        headers: { 'x-line-uid': uid }
      });
      const data = await response.json();
      
      if (response.ok) {
        setStaff(data);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`確定要完全刪除 ${name} 的帳號資料嗎？這通常用於清除錯誤綁定的幽靈帳號。`)) return;
    try {
      const res = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-line-uid': currentUid 
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        alert('刪除成功');
        fetchStaff();
      } else {
        const err = await res.json();
        alert('刪除失敗: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnbind = async (id, name) => {
    if (!window.confirm(`確定要解除 ${name} 的 LINE 綁定嗎？這將讓他可以重新綁定新的 LINE 帳號。`)) return;
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-line-uid': currentUid 
        },
        body: JSON.stringify({ id, updates: { line_uid: null } })
      });
      if (res.ok) {
        alert('解除綁定成功');
        fetchStaff();
      } else {
        const err = await res.json();
        alert('解除綁定失敗: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';
  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={`rounded-2xl shadow-sm p-5 border ${cardBg}`}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={20} className="text-purple-600 dark:text-purple-400" />
        <h3 className={`text-lg font-extrabold ${textColor}`}>全校教職員與權限清單</h3>
      </div>
      {isLoading ? (
        <p className="text-purple-600 font-bold text-center py-6 animate-pulse text-sm">載入中...</p>
      ) : staff.length === 0 ? (
        <p className={`${subTextColor} text-center py-6 text-sm`}>目前尚無教職員資料</p>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className={`p-4 rounded-xl border flex flex-col gap-2 transition ${isDark ? 'border-slate-800 bg-slate-800/60' : 'border-stone-200 bg-stone-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`font-extrabold ${textColor}`}>{s.name} <span className="text-xs font-normal text-stone-400">({s.title || '無職稱'})</span></h4>
                  <p className="text-xs text-stone-400 mt-0.5">{s.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border ${
                    s.line_uid 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                      : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                  }`}>
                    {s.line_uid ? (
                      <>
                        <Check size={12} />
                        已綁定LINE
                      </>
                    ) : (
                      <>
                        <X size={12} />
                        未綁定
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-400">權限標籤:</span>
                  <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold border border-purple-200 dark:border-purple-800">
                    {s.role_tags || '無'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {s.line_uid && (
                    <button 
                      onClick={() => handleUnbind(s.id, s.name)}
                      className="text-xs px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 rounded-lg font-bold transition"
                    >
                      解除綁定
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(s.id, s.name)}
                    className="text-xs px-3 py-1 bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900 rounded-lg font-bold transition"
                  >
                    徹底刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
