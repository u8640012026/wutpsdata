import React, { useState } from 'react';
import Timeline from '../components/Timeline';
import { useApp } from '../App';
import * as XLSX from 'xlsx';
import liff from '@line/liff';
import { supabase } from '../supabaseClient';
import RepairDashboard from './RepairDashboard';
import StaffList from '../components/StaffList';
import StudentList from '../components/StudentList';
import BulletinBoard from '../components/BulletinBoard';

const mockEvents = [
  { date: '2023-11-01', title: '?¨æ ¡?‹å???/ Sports Day', description: 'è«‹å…¨é«”å¸«?Ÿæ??‚æ–¼?å ´?†å? / Gather at the field' },
  { date: '2023-11-15', title: '?Ÿä¸­??/ Midterm', description: '?Ÿä¸­è©•é? / Midterm exams' },
];

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('menu');
  const [isEditing, setIsEditing] = useState(false);
  const [events, setEvents] = useState(mockEvents);
  const { isDark, t, staffData } = useApp();
  
  const [uploadStatus, setUploadStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setUploadStatus('æ­?œ¨è®€??Excel æª”æ?...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setUploadStatus(`æª”æ?è®€?–æ??Ÿï???${data.length} ç­†è??™ã€‚é?å§‹ä??³è‡³è³‡æ?åº?..`);

        const formattedData = data.map(row => {
          // ?·å??€?‰é??¸å?æ¬„ä??¾å…¥ details
          const { å­¸è?, å§“å?, å¹´ç?, ?­ç?, åº§è?, ?¨å­¸?–è‡ªå­? ?¶è¦ª?»è©±, æ¯è¦ª?»è©±, ...otherDetails } = row;
          
          return {
            student_id: String(å­¸è? || ''),
            name: å§“å? || '?ªçŸ¥',
            grade: String(å¹´ç? || ''),
            class_name: String(?­ç? || ''),
            seat_number: String(åº§è? || ''),
            enroll_type: ?¨å­¸?–è‡ªå­?|| '??,
            parent_phone: String(?¶è¦ª?»è©± || æ¯è¦ª?»è©± || ''),
            details: otherDetails
          };
        }).filter(item => item.student_id); // ?æ¿¾?‰æ??‰å­¸?Ÿç?ç©ºè?

        if (formattedData.length === 0) {
          throw new Error('?¾ä??°æ??ˆç?å­¸ç?è³‡æ?ï¼Œè?ç¢ºè? Excel ?…å«?Œå­¸?Ÿã€è??Œå??ã€æ?ä½ã€?);
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
        if (!response.ok) throw new Error(result.error || '?ªçŸ¥?„éŒ¯èª?);
        
        setUploadStatus(`???å??¯å…¥ ${result.count} ç­†å­¸?Ÿè??™ï? (ä¸¦å·²å¯«å…¥å®‰å…¨?¥è?)`);
      } catch (err) {
        console.error(err);
        setUploadStatus(`??ä¸Šå‚³å¤±æ?: ${err.message}`);
      } finally {
        setIsLoading(false);
        e.target.value = null; // æ¸…ç©º input
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStaffUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setUploadStatus('è®€?–æ??·å“¡ Excel æª”æ?ä¸?..');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setUploadStatus(`æª”æ?è®€?–æ??Ÿï???${data.length} ç­†è??™ã€‚é?å§‹å¯«?¥è??™åº«...`);

        const formattedData = data.map(rawRow => {
          // æ¸…ç? Excel è¡¨é ­?¯èƒ½å¸¶æ??„éš±å½¢ç©º?½æ??›è?ç¬¦è?
          const row = {};
          for (let key in rawRow) {
            row[key.trim()] = rawRow[key];
          }
          
          return {
            name: row['å§“å?'] || row.name || '?ªçŸ¥',
            department: row['?•å®¤'] || row.department || '',
            title: row['?·ç¨±'] || row.title || '',
            class_assigned: row['ä»»æ??­ç?'] || row.class_assigned || '',
            email: String(row['?»å?ä¿¡ç®±'] || row.email || '').trim(),
            role_tags: String(row['è§’è‰²æ¨™ç±¤'] || row.role_tags || '')
          };
        }).filter(item => item.email); // ?»å?ä¿¡ç®±?¯å?å¡«ä¸»??

        if (formattedData.length === 0) {
          throw new Error('?ªæ‰¾?°æ??ˆè??™ï?è«‹ç¢ºä¿å??«ã€Œé›»å­ä¿¡ç®±ã€æ?ä½?);
        }

        const response = await fetch('/api/staff_import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_uid: liff.isLoggedIn() ? (await liff.getProfile()).userId : 'dev-admin',
            staffData: formattedData
          })
        });

        const result = await response.json();
        if (response.ok) {
          setUploadStatus(`???å??´æ–° ${result.count} ç­†æ??·å“¡è³‡æ?ï¼??Ÿç?å®šè??™å·²?ªå?ä¿ç?)`);
        } else {
          setUploadStatus(`???¯èª¤: ${result.error}`);
        }
      } catch (err) {
        setUploadStatus(`??è§??å¤±æ?: ${err.message}`);
      } finally {
        setIsLoading(false);
        e.target.value = null; // æ¸…ç©º input
      }
    };
    reader.readAsBinaryString(file);
  };

  const textColor = isDark ? 'text-white' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-slate-800' : 'bg-white';

  if (currentView === 'repair') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100/60 text-blue-600'}`}
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
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100/60 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>

        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>ç³»çµ±è³‡æ?åº«ç®¡??/h2>
          <p className={`text-sm ${subTextColor}`}>?è¨»?Šç??·è?ç³»çµ±ç®¡ç??…å???/p>
        </div>

        {uploadStatus && (
          <div className={`p-4 rounded-lg text-sm font-semibold ${uploadStatus.includes('??) ? 'bg-green-100 text-green-700' : uploadStatus.includes('??) ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {uploadStatus}
          </div>
        )}

        {/* å­¸ç?è³‡æ?ä¸Šå‚³?€å¡?*/}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-blue-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>?‘¦ ?¯å…¥å­¸ç?ç¸½è¡¨</h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>?…å«å­¸è??å¹´ç´šã€ç­ç´šã€é†«?‚ã€å®¶?·ç? 31 ?‹å??´æ?ä½?/p>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <svg className={`mx-auto h-8 w-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <label className={`cursor-pointer rounded text-white text-sm px-3 py-1.5 ${isLoading ? 'bg-gray-400' : 'bg-blue-100/600 hover:bg-blue-600'}`}>
              {isLoading ? '?•ç?ä¸?..' : '?¸æ? Excel / CSV æª”æ?'}
              <input type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleStudentUpload} disabled={isLoading} />
            </label>
          </div>
        </section>

        {/* ?™è·?¡è??™ä??³å?å¡?*/}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-green-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>?‘¨?ğ???¯å…¥?™è·?¡å???/h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>?¨æ–¼?‹é€šæ??ï??…å«å§“å??è·?™ã€ä»»?™ç­ç´šã€ä¿¡ç®?/p>
          <div className={`border-2 border-dashed rounded-lg p-6 text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
            <svg className={`mx-auto h-8 w-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <label className={`cursor-pointer rounded text-white text-sm px-3 py-1.5 ${isLoading ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}>
              {isLoading ? '?•ç?ä¸?..' : '?¸æ? Excel / CSV æª”æ?'}
              <input type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleStaffUpload} disabled={isLoading} />
            </label>
          </div>
        </section>

        {/* è¡Œä??†è¨­å®šå?å¡?*/}
        <section className={`rounded-xl shadow-sm p-5 border-l-4 border-yellow-500 ${cardBg}`}>
          <h3 className={`text-lg font-bold mb-1 ${textColor}`}>?? ä»‹æ¥ Google ?¥æ?</h3>
          <p className={`text-xs mb-4 ${subTextColor}`}>è¨­å??¨æ ¡è¡Œä??†ä?æº?/p>
          <div className="space-y-3">
            <input type="text" placeholder="è«‹è¼¸??Google Calendar ID" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
            <input type="text" placeholder="è«‹è¼¸??API Key" className={`w-full text-sm p-2 border rounded ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white'}`} />
            <button className={`w-full font-semibold py-2 rounded text-sm ${isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-700'}`}>
              ?²å?ä¸¦å?æ­¥æ—¥??
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
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100/60 text-blue-600'}`}
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
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100/60 text-blue-600'}`}
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
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-slate-700 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>

        <StudentList />
      </div>
    );
  }

  if (currentView === 'staff_list') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-100/60 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>
        <StaffList />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className={`text-2xl font-bold ${textColor}`}>{t.adminTitle}</h2>
        <p className={`text-sm ${subTextColor}`}>{t.adminDesc}</p>
      </div>

      <BulletinBoard />

      <div className="grid grid-cols-1 gap-4 mt-6">
        <button 
          onClick={() => setCurrentView('calendar')}
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition active:scale-[0.98] border ${isDark ? 'bg-orange-950/30 hover:bg-orange-900/40 border-orange-900/50' : 'bg-orange-100/60 hover:bg-orange-100 border-orange-100'}`}
        >
          <div className="text-left">
            <h3 className={`text-lg font-bold ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>{t.calendarTitle} <span className="text-xs font-normal opacity-80">(?‹ç™¼æ¨?œ¬ - å°šæœªä¸²æ¥ Google)</span></h3>
            <p className={`text-sm ${isDark ? 'text-orange-500/70' : 'text-orange-600/70'}`}>{t.calendarDesc}</p>
          </div>
          <svg className={`w-6 h-6 ${isDark ? 'text-orange-500' : 'text-orange-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        <button 
          onClick={() => setCurrentView('students')}
          className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition border ${isDark ? 'bg-blue-950/30 hover:bg-blue-900/40 border-blue-900/50' : 'bg-blue-100/60 hover:bg-blue-100 border-blue-100'}`}
        >
          <div className="text-left">
            <h3 className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{t.rosterTitle}</h3>
            <p className={`text-sm ${isDark ? 'text-blue-500/70' : 'text-blue-600/70'}`}>{t.rosterDesc}</p>
          </div>
          <svg className={`w-6 h-6 ${isDark ? 'text-blue-500' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {(staffData?.role_tags?.includes('0') || staffData?.email?.includes('u864001')) && (
          <>
            <button 
              onClick={() => setCurrentView('staff_list')}
              className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:shadow-md'}`}
            >
              <div className="text-left">
                <h3 className={`text-lg font-bold text-purple-600`}>?‘¨?ğ???™è·?¡å??Šè?æ¬Šé?ç®¡ç?</h3>
                <p className={`text-sm ${subTextColor}`}>è¶…ç?ç®¡ç??¡å?å±¬ï??¥ç?ç¶å??€?‹è?æ¬Šé?</p>
              </div>
              <svg className={`w-6 h-6 text-purple-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </button>

            <button 
              onClick={() => setCurrentView('import')}
              className={`p-6 rounded-xl shadow-sm flex items-center justify-between transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 border border-emerald-900' : 'bg-white hover:shadow-md border border-emerald-100'}`}
            >
              <div className="text-left">
                <h3 className={`text-lg font-bold text-emerald-600`}>??ï¸?ç³»çµ±è³‡æ?åº«åŒ¯?¥å?</h3>
                <p className={`text-sm ${subTextColor}`}>è¶…ç?ç®¡ç??¡å?å±¬ï??¹æ¬¡ä¸Šå‚³å­¸ç??‡æ??·å“¡</p>
              </div>
              <svg className={`w-6 h-6 text-emerald-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
