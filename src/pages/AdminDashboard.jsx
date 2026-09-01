import React, { useState } from 'react';
import Timeline from '../components/Timeline';
import { useApp } from '../App';

const mockEvents = [
  { date: '2023-11-01', title: '全校運動會 / Sports Day', description: '請全體師生準時於操場集合 / Gather at the field' },
  { date: '2023-11-15', title: '期中考 / Midterm', description: '各科期中評量 / Midterm exams' },
];

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('menu');
  const [isEditing, setIsEditing] = useState(false);
  const [events, setEvents] = useState(mockEvents);
  const { isDark, t } = useApp();

  const textColor = isDark ? 'text-white' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

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
          <h2 className={`text-2xl font-bold ${textColor}`}>匯入學生資料</h2>
          <p className={`text-sm ${subTextColor}`}>Excel/CSV 批次上傳或手動新增</p>
        </div>

        <section className={`rounded-xl shadow-sm p-6 ${cardBg}`}>
          <div className={`border-2 border-dashed rounded-xl p-8 text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
            <svg className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="mt-4 flex text-sm justify-center">
              <label className="relative cursor-pointer bg-blue-500 rounded-md font-medium text-white px-3 py-1 hover:bg-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                <span>選擇檔案</span>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" />
              </label>
              <p className={`pl-2 pt-1 ${subTextColor}`}>或將檔案拖曳至此</p>
            </div>
            <p className={`text-xs mt-2 ${subTextColor}`}>支援 .xlsx, .csv 格式 (上限 10MB)</p>
          </div>
          
          <div className="mt-6">
            <h4 className={`text-sm font-bold mb-3 ${textColor}`}>或者手動新增單筆資料</h4>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="學號" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
              <input type="text" placeholder="姓名" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
              <input type="text" placeholder="年級/班級" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
              <input type="text" placeholder="家長手機" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
            </div>
            <button className={`w-full font-semibold py-2 mt-3 rounded text-sm ${isDark ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-600'}`}>
              單筆新增
            </button>
          </div>
        </section>
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
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:shadow-md'}`}
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
