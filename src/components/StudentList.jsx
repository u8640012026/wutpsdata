import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import liff from '@line/liff';

export default function StudentList() {
  const { isDark, staffData } = useApp();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const roleTags = staffData?.role_tags || '';
  const isAdmin = ['0', '1', '2', '3', '20', '30', '40', '50'].some(r => roleTags.includes(r));
  const isHomeroom = roleTags.includes('4') && !isAdmin;

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [isViewing, setIsViewing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('basic');
  const [showHomeschooled, setShowHomeschooled] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      let uid = 'dev-admin';
      if (window.liff?.isLoggedIn()) {
        const profile = await window.liff.getProfile();
        uid = profile.userId;
      }

      const response = await fetch('/api/students', {
        headers: { 'x-line-uid': uid }
      });
      const data = await response.json();
      
      if (response.ok) {
        setStudents(data);
        
        // 若為導師，自動展開他的班級 (來自 excel 上傳的 "任教班級")
        if (isHomeroom) {
          const myClass = staffData?.details?.['任教班級'];
          if (myClass) {
            setSelectedClasses([myClass]);
            setIsViewing(true);
          } else if (data.length > 0) {
            setSelectedClasses([`${data[0].grade}${data[0].class_name}`]);
            setIsViewing(true);
          }
        }
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const toggleClass = (cls) => {
    if (selectedClasses.includes(cls)) {
      setSelectedClasses(selectedClasses.filter(c => c !== cls));
    } else {
      setSelectedClasses([...selectedClasses, cls]);
    }
  };

  const formatExcelDate = (val) => {
    if (!val) return '';
    const strVal = String(val).trim();
    if (strVal.includes('/') || strVal.includes('-') || strVal.includes('年')) return strVal;
    
    const num = Number(strVal);
    if (!isNaN(num) && num > 10000 && num < 70000) {
      // Excel serial date to JS Date (days since 1899-12-30)
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      const year = date.getUTCFullYear() - 1911;
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      return `${year}/${month}/${day}`;
    }
    return strVal;
  };

  const filteredStudents = students.filter(s => {
    if (!selectedClasses.includes(`${s.grade}${s.class_name}`)) return false;
    
    // 終極自學生攔截邏輯：直接掃描該學生所有的資料欄位值 (避免 Excel 欄位名稱異動導致漏接)
    const allValues = [s.enroll_type, ...Object.values(s.details || {})].map(v => String(v || ''));
    const isHomeschooled = allValues.some(v => v.includes('自學') || v.includes('在家') || v.includes('非在校'));
    
    if (!showHomeschooled && isHomeschooled) return false;
    
    return true;
  });

  const cardBg = isDark ? 'bg-slate-800' : 'bg-white';
  const textColor = isDark ? 'text-stone-100' : 'text-stone-800';
  const tableHeaderBg = isDark ? 'bg-slate-700' : 'bg-emerald-100';
  const stickyLeftBg = isDark ? 'bg-slate-800' : 'bg-white';
  const borderColor = isDark ? 'border-slate-700' : 'border-emerald-200';

  const tabs = [
    { id: 'basic', label: '基本資料', cols: ['性別', '身分證字號', '生日'] }, // 移除就讀狀態
    { id: 'family', label: '家庭資料', cols: ['父親', '父親電話', '母親', '母親電話', '戶籍地址', '通訊地址'] },
    { id: 'health', label: '健康頁', cols: ['緊急連絡人', '緊急聯絡人電話', '特殊病況', '緊急送醫處'] },
    { id: 'indigenous', label: '族語頁', cols: ['族名', '族別', '語系', '族語認證', '新增族語註記'] },
    { id: 'english', label: '英語頁', cols: ['英語名', '新增英語註記'] },
    { id: 'status', label: '身分欄位頁', cols: ['中低軍公教', '特教生', '輔導個案'] },
    { id: 'funding', label: '經費頁', cols: ['午餐費', '代辦費', '平安保險費', '教科書費', '家長會費', '運動服費', '獎助學金'] }
  ];

  const currentCols = tabs.find(t => t.id === activeTab)?.cols || [];

  if (isLoading) {
    return <p className="text-gray-500 text-center py-8 font-bold animate-pulse">載入學生資料中...</p>;
  }

  // 顯示班級選擇 (若為行政且尚未進入檢視模式)
  if (!isViewing) {
    const classGrid = [
      ['一甲', '二甲', '三甲'],
      ['四甲', '五甲', '六甲'],
      ['一乙', '二乙', '三乙'],
      ['四乙', '五乙', '六乙']
    ];

    return (
      <div className={`rounded-xl shadow-sm p-6 flex flex-col h-[70vh] ${cardBg}`}>
        <h3 className={`text-xl font-bold mb-2 ${textColor}`}>🏫 請點選要檢視的班級 (可複選)</h3>
        <p className="text-sm text-gray-500 mb-6">點擊班級按鈕來選取或取消選取，選取完畢後請按下方的「確定」按鈕。</p>
        
        <div className="flex-1 overflow-y-auto space-y-6">
          {classGrid.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-3 gap-4">
              {row.map(cls => {
                const isJia = cls.includes('甲');
                const isSelected = selectedClasses.includes(cls);
                
                // 動態決定選取與未選取的樣式
                let btnClass = 'py-4 px-2 rounded-[2rem] font-extrabold text-lg border-2 transition-all hover:scale-105 active:scale-95 shadow-sm ';
                if (isJia) {
                  btnClass += isSelected 
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/50 shadow-lg scale-105'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-800/50';
                } else {
                  btnClass += isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/50 shadow-lg scale-105'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700 dark:hover:bg-indigo-800/50';
                }

                return (
                  <button
                    key={cls}
                    onClick={() => toggleClass(cls)}
                    className={btnClass}
                  >
                    {cls}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        
        <div className="pt-4 border-t mt-4 border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setIsViewing(true)}
            disabled={selectedClasses.length === 0}
            className={`w-full py-4 rounded-xl font-extrabold text-lg transition-all shadow-md active:scale-95 ${
              selectedClasses.length > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
            }`}
          >
            {selectedClasses.length > 0 ? `確定檢視 ${selectedClasses.length} 個班級` : '請先選取班級'}
          </button>
        </div>
      </div>
    );
  }

  // 跨班檢視時標題
  const titleText = selectedClasses.length === 1 
    ? `${selectedClasses[0]} 學生名冊` 
    : `跨班學生名冊 (共 ${selectedClasses.length} 班)`;

  // 全螢幕樣式切換
  const containerStyle = isFullscreen
    ? `fixed inset-0 z-[100] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-stone-50'} pb-2`
    : `rounded-xl shadow-sm flex flex-col h-[70vh] ${cardBg} border ${borderColor}`;

  return (
    <div className={containerStyle}>
      
      {/* 頂部標題列與返回按鈕 */}
      <div className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {(isAdmin || !isHomeroom) && (
            <button 
              onClick={() => setIsViewing(false)}
              className="p-1.5 rounded-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h3 className={`text-lg font-bold ${textColor}`}>🧑‍🎓 {titleText}</h3>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 全螢幕切換按鈕 */}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-slate-700 dark:text-blue-400 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-slate-600"
          >
            {isFullscreen ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                縮小還原
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                全螢幕展開
              </>
            )}
          </button>

          <label className="flex items-center gap-2 cursor-pointer bg-stone-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
            <input 
              type="checkbox" 
              checked={showHomeschooled} 
              onChange={(e) => setShowHomeschooled(e.target.checked)} 
              className="w-4 h-4 text-emerald-600 rounded border-gray-300"
            />
            <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>顯示在家自學生</span>
          </label>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-full whitespace-nowrap">
            共 {filteredStudents.length} 人
          </span>
        </div>
      </div>

      {/* Excel-like Data Table 區塊 */}
      {/* 調整為 text-base 讓手機版字體更大更清晰 */}
      <div className="flex-1 overflow-auto relative scrollbar-hide">
        <table className="w-full text-base text-left whitespace-nowrap">
          <thead className={`sticky top-0 z-20 ${tableHeaderBg} shadow-sm`}>
            <tr>
              {/* 凍結的左側第一欄 */}
              <th className={`sticky left-0 z-30 p-3 font-extrabold text-emerald-800 dark:text-emerald-300 border-r border-b ${borderColor} ${tableHeaderBg}`}>
                班級 - 座號 - 姓名
              </th>
              {/* 動態展開的資料欄位 */}
              {currentCols.map(col => (
                <th key={col} className={`p-3 font-bold text-gray-700 dark:text-gray-200 border-r border-b ${borderColor}`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={currentCols.length + 1} className="p-8 text-center text-gray-500 font-bold">
                  目前無符合條件的學生資料
                </td>
              </tr>
            )}
            {filteredStudents.map((student, idx) => {
              const details = student.details || {};
              const isEven = idx % 2 === 0;
              const rowBg = isDark ? (isEven ? 'bg-slate-800' : 'bg-slate-800/80') : (isEven ? 'bg-white' : 'bg-emerald-50/30');

              return (
                <tr key={student.student_id} className={`border-b ${borderColor} ${rowBg} hover:bg-yellow-50 dark:hover:bg-slate-700 transition-colors`}>
                  {/* 凍結的左側儲存格 */}
                  <td className={`sticky left-0 z-10 p-3 border-r ${borderColor} ${stickyLeftBg} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400 w-8">{student.grade}{student.class_name}</span>
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-bold">
                        {student.seat_number}
                      </span>
                      <span className={`font-bold ${textColor} w-20 truncate`}>{student.name}</span>
                      {/* 若為自學生，加上小標籤 */}
                      {[student.enroll_type, ...Object.values(details)].some(v => String(v||'').includes('自學') || String(v||'').includes('在家')) && (
                        <span className="text-[11px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1">自學</span>
                      )}
                    </div>
                  </td>
                  
                  {/* 動態資料儲存格 */}
                  {currentCols.map(col => {
                    // 特殊處理欄位容錯
                    let val = details[col] || details[col.replace('頁', '')] || '';
                    if (col === '性別' && !val) val = details['姓別'] || ''; 
                    
                    // 生日格式處理
                    if (col === '生日') val = formatExcelDate(val);

                    return (
                      <td key={col} className={`p-3 border-r ${borderColor} text-gray-600 dark:text-gray-300 max-w-[250px] truncate`}>
                        {val || '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Excel 底部切換頁籤 (Bottom Tabs) */}
      <div className={`flex overflow-x-auto p-2 gap-2 border-t ${borderColor} bg-gray-100 dark:bg-slate-900 scrollbar-hide`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2.5 rounded-t-lg font-bold text-base transition-all border border-b-0 ${
              activeTab === tab.id 
                ? `${cardBg} text-emerald-600 ${borderColor} shadow-[0_-2px_5px_rgba(0,0,0,0.05)] border-b-transparent z-10` 
                : 'bg-gray-200 dark:bg-slate-800 text-gray-500 border-transparent hover:bg-gray-300 dark:hover:bg-slate-700'
            }`}
            style={{ marginBottom: activeTab === tab.id ? '-1px' : '0' }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
