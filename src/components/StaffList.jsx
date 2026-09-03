import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import liff from '@line/liff';

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

  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';

  return (
    <div className={`rounded-xl shadow-sm p-4 ${cardBg}`}>
      <h3 className={`text-lg font-bold mb-4 ${textColor}`}>全校教職員與權限清單</h3>
      {isLoading ? (
        <p className="text-gray-500 text-center py-4">載入中...</p>
      ) : staff.length === 0 ? (
        <p className="text-gray-500 text-center py-4">目前尚無教職員資料</p>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`font-bold ${textColor}`}>{s.name} <span className="text-sm font-normal text-gray-500">({s.title || '無職稱'})</span></h4>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${s.line_uid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.line_uid ? '✓ 已綁定LINE' : '✕ 未綁定'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">權限標籤:</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                    {s.role_tags || '無'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {s.line_uid && (
                    <button 
                      onClick={() => handleUnbind(s.id, s.name)}
                      className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded font-bold transition"
                    >
                      解除綁定
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(s.id, s.name)}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded font-bold transition"
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
