import React, { useState } from 'react';
import Timeline from '../components/Timeline';
import { useApp } from '../App';
import * as XLSX from 'xlsx';
import liff from '@line/liff';
import { supabase } from '../supabaseClient';
import RepairDashboard from './RepairDashboard';

const mockEvents = [
  { date: '2023-11-01', title: '全校運動會 / Sports Day', description: '請全體師生準時於操場集合 / Gather at the field' },
  { date: '2023-11-15', title: '期中考 / Midterm', description: '各科期中評量 / Midterm exams' },
];

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('menu');
  const [isEditing, setIsEditing] = useState(false);
  const [events, setEvents] = useState(mockEvents);
  const { isDark, t } = useApp();
  
  const [uploadStatus, setUploadStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setUploadStatus('正在讀取 Excel 檔案...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setUploadStatus(`檔案讀取成功，共 ${data.length} 筆資料。開始上傳至資料庫...`);

        const formattedData = data.map(row => {
          // 擷取所有非核心欄位放入 details
          const { 學號, 姓名, 年級, 班級, 座號, 在學或自學, 父親電話, 母親電話, ...otherDetails } = row;
          
          return {
            student_id: String(學號 || ''),
            name: 姓名 || '未知',
            grade: String(年級 || ''),
            class_name: String(班級 || ''),
            seat_number: String(座號 || ''),
            enroll_type: 在學或自學 || '在',
            parent_phone: String(父親電話 || 母親電話 || ''),
            details: otherDetails
          };
        }).filter(item => item.student_id); // 過濾掉沒有學號的空行

        if (formattedData.length === 0) {
          throw new Error('找不到有效的學生資料，請確認 Excel 包含「學號」與「姓名」欄位。');
        }

        const response = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_uid: liff.isLoggedIn() ? (await liff.getProfile()).userId : 'dev-admin',
            studentsData: formattedData
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '未知的錯誤');
        
        setUploadStatus(`✅ 成功匯入 ${result.count} 筆學生資料！ (並已寫入安全日誌)`);
      } catch (err) {
        console.error(err);
        setUploadStatus(`❌ 上傳失敗: ${err.message}`);
      } finally {
        setIsLoading(false);
        e.target.value = null; // 清空 input
      }
    };
    reader.readAsBinaryString(file);
  };

  const textColor = isDark ? 'text-white' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  if (currentView === 'repair') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>
        <RepairDashboard />
      </div>
    );
  }

  if (currentView === 'import') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>

        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>系統資料庫管理</h2>
          <p className={`text-sm ${subTextColor}`}>限註冊組長與系統管理者存取</p>
        </div>

        {uploadStatus && (
          <div className={`p-4 rounded-lg text-sm font-semibold ${uploadStatus.includes('✅') ? 'bg-green-100 text-green-700' : uploadStatus.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {uploadStatus}
          </div>
        )}

        {/* 學生資料上傳區塊 */}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-blue-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>👦 匯入學生總表</h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>包含學號、年級、班級、醫療、家長等 31 個完整欄位</p>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <svg className={`mx-auto h-8 w-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <label className={`cursor-pointer rounded text-white text-sm px-3 py-1.5 ${isLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {isLoading ? '處理中...' : '選擇 Excel / CSV 檔案'}
              <input type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleStudentUpload} disabled={isLoading} />
            </label>
          </div>
        </section>

        {/* 教職員資料上傳區塊 */}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-green-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>👨‍🏫 匯入教職員名冊</h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>用於開通權限，包含姓名、職務、任教班級、信箱</p>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
            <svg className={`mx-auto h-8 w-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <label className="cursor-pointer bg-green-500 rounded text-white text-sm px-3 py-1.5 hover:bg-green-600">
              選擇 Excel / CSV 檔案
              <input type="file" className="sr-only" />
            </label>
          </div>
        </section>

        {/* 行事曆設定區塊 */}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-yellow-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>📅 介接 Google 日曆</h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>設定全校行事曆來源</p>
          <div className="space-y-3">
            <input type="text" placeholder="請輸入 Google Calendar ID" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
            <input type="text" placeholder="請輸入 API Key" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
            <button className={`w-full font-semibold py-2 rounded text-sm ${isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'}`}>
              儲存並同步日曆
            </button>
          </div>
        </section>

      </div>
    );
  }

  if (currentView === 'repair') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>
        <RepairDashboard />
      </div>
    );
  }

  if (currentView === 'calendar') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => { setCurrentView('menu'); setIsEditing(false); }}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>

        <div className="flex justify-between items-end">
          <div>
            <h2 className={`text-2xl font-bold ${textColor}`}>{t.calendarTitle}</h2>
            <p className={`text-sm ${subTextColor}`}>{t.calendarDesc}</p>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-1.5 rounded text-sm font-medium ${
              isEditing ? (isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-700') : 'bg-red-500 text-white shadow'
            }`}
          >
            {isEditing ? t.finishView : t.editMode}
          </button>
        </div>

        <section className={`rounded-xl shadow-sm p-4 ${cardBg}`}>
          {isEditing && (
            <div className={`mb-6 p-4 rounded-lg border border-dashed ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
              <h4 className={`text-sm font-bold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t.addEvent}</h4>
              <div className="space-y-2">
                <input type="date" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
                <input type="text" placeholder={t.eventTitle} className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
                <button className={`w-full font-semibold py-2 rounded text-sm ${isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-600'}`}>
                  {t.addCalendar}
                </button>
              </div>
            </div>
          )}
          <Timeline events={events} />
        </section>
      </div>
    );
  }

  if (currentView === 'students') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>

        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>{t.rosterTitle}</h2>
          <p className={`text-sm ${subTextColor}`}>{t.rosterDesc}</p>
        </div>

        <section className={`rounded-xl shadow-sm p-4 text-center py-8 ${cardBg}`}>
          <p className={subTextColor}>(此處為全校學生名冊列表，為簡化 Demo 暫時省略)</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className={`text-2xl font-bold ${textColor}`}>{t.adminTitle}</h2>
        <p className={`text-sm ${subTextColor}`}>{t.adminDesc}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button 
          onClick={() => setCurrentView('calendar')}
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition active:scale-[0.98] ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:shadow-md'}`}
        >
          <div className="text-left">
            <h3 className={`text-lg font-bold ${textColor}`}>{t.calendarTitle}</h3>
            <p className={`text-sm ${subTextColor}`}>{t.calendarDesc}</p>
          </div>
          <svg className={`w-6 h-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={() => setCurrentView('students')}
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:shadow-md'}`}
        >
          <div className="text-left">
            <h3 className={`text-lg font-bold ${textColor}`}>{t.rosterTitle}</h3>
            <p className={`text-sm ${subTextColor}`}>{t.rosterDesc}</p>
          </div>
          <svg className={`w-6 h-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={() => setCurrentView('import')}
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition ${isDark ? 'bg-gray-800 hover:bg-gray-700 border border-blue-900' : 'bg-white hover:shadow-md border border-blue-100'}`}
        >
          <div className="text-left">
            <h3 className={`text-lg font-bold text-blue-500`}>匯入學生資料</h3>
            <p className={`text-sm ${subTextColor}`}>以 Excel 批次上傳全校名單</p>
          </div>
          <svg className={`w-6 h-6 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </button>
      </div>
    </div>
  );
}
