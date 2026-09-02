import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useApp } from '../App';

export default function StaffList() {
  const { isDark } = useApp();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setStaff(data);
    }
    setIsLoading(false);
  };

  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';

  return (
    <div className={`rounded-xl shadow-sm p-4 ${cardBg}`}>
      <h3 className={`text-lg font-bold mb-4 ${textColor}`}>👨‍🏫 教職員名冊與權限狀態</h3>
      {isLoading ? (
        <p className="text-gray-500 text-center py-4">載入中...</p>
      ) : staff.length === 0 ? (
        <p className="text-gray-500 text-center py-4">目前尚無教職員資料。</p>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className={`p-3 rounded-lg border flex flex-col gap-2 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`font-bold ${textColor}`}>{s.name} <span className="text-sm font-normal text-gray-500">({s.title || '無職務'})</span></h4>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${s.line_uid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.line_uid ? '✅ 已綁定 LINE' : '❌ 未綁定'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">權限標籤:</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-mono">
                  {s.role_tags || '無'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
