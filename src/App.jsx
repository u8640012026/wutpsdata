import React, { useState, useEffect, createContext, useContext } from 'react';
import LiffLogin from './components/LiffLogin';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import { translations } from './i18n';
import liff from '@line/liff';
import { supabase } from './supabaseClient';

export const AppContext = createContext();

export const useApp = () => useContext(AppContext);

const LIFF_ID = '2011376584-Ia2rhpXU';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', 'parent'
  const [lang, setLang] = useState('zh');
  const [isDark, setIsDark] = useState(false);
  
  const [liffProfile, setLiffProfile] = useState(null);
  const [isLiffInit, setIsLiffInit] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    liff.init({ liffId: LIFF_ID }).then(() => {
      setIsLiffInit(true);
      if (liff.isLoggedIn()) {
        liff.getProfile().then(profile => {
          setLiffProfile(profile);
          checkUserRole(profile.userId);
        });
      }
    }).catch(err => console.error('LIFF init failed', err));
  }, []);

  // 根據 LINE UID 檢查身分
  const checkUserRole = async (lineUid) => {
    try {
      // 檢查是否為教職員
      const { data: staffData } = await supabase.from('staff').select('*').eq('line_uid', lineUid).single();
      if (staffData) {
        setUserRole(staffData.title === '行政' || staffData.email.includes('u864001') ? 'admin' : 'teacher');
        setIsLoggedIn(true);
        return;
      }
      // TODO: 檢查家長 (students table)
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUserRole(null);
    setIsLoggedIn(false);
    // 如果是真實 LINE 登入，也可以選擇呼叫 liff.logout()
  };

  const toggleTheme = () => setIsDark(!isDark);
  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const contextValue = { lang, isDark, t, handleLogout, liffProfile };

  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-screen flex flex-col ${isDark ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
        {isLoggedIn && (
          <header className={`shadow px-4 py-3 flex justify-between items-center sticky top-0 z-10 ${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-white'}`}>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleLogout}
                className={`p-2 rounded-full transition-colors flex items-center justify-center ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
                title={t.home}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </button>
              <h1 className="text-xl font-bold">{t.appTitle}</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {liffProfile && (
                <img src={liffProfile.pictureUrl} alt="profile" className="w-6 h-6 rounded-full" />
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                {t[userRole]}
              </span>
              <button onClick={toggleLang} className={`font-bold px-2 py-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                {lang === 'zh' ? 'EN' : 'ZH'}
              </button>
              <button onClick={toggleTheme} className={`p-1.5 rounded-full ${isDark ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-200 text-gray-600'}`}>
                {isDark ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
                )}
              </button>
            </div>
          </header>
        )}
        
        <main className="flex-1 w-full max-w-md mx-auto p-4">
          {!isLoggedIn && <LiffLogin onLogin={handleLogin} toggleLang={toggleLang} toggleTheme={toggleTheme} lang={lang} isDark={isDark} t={t} liffProfile={liffProfile} isLiffInit={isLiffInit} />}
          {userRole === 'admin' && <AdminDashboard />}
          {userRole === 'teacher' && <TeacherDashboard />}
          {userRole === 'parent' && <ParentDashboard />}
        </main>
      </div>
    </AppContext.Provider>
  );
}

export default App;
