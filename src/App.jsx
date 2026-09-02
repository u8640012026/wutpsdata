import React, { useState, useEffect, createContext, useContext } from 'react';
import LiffLogin from './components/LiffLogin';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import RepairDashboard from './pages/RepairDashboard';
import { translations } from './i18n';
import liff from '@line/liff';

export const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const LIFF_ID = '2011376584-Ia2rhpXU';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', 'parent'
  const [staffData, setStaffData] = useState(null);
  const [lang, setLang] = useState('zh');
  const [isDark, setIsDark] = useState(false);
  const [currentTab, setCurrentTab] = useState('home'); // 'home', 'repairs', 'profile'
  
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

  const checkUserRole = async (lineUid) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_uid: lineUid })
      });
      const data = await response.json();
      if (response.ok && data.role) {
        setUserRole(data.role);
        setStaffData(data.staffData || null);
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error('API 驗證失敗', err);
    }
  };

  const handleLogin = (role) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setUserRole(null);
    setStaffData(null);
    setIsLoggedIn(false);
    setCurrentTab('home');
  };

  const toggleTheme = () => setIsDark(!isDark);
  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const contextValue = { lang, isDark, t, handleLogout, liffProfile, staffData, userRole };

  // 全域背景使用灰色，讓白色卡片突顯
  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark bg-gray-900 text-gray-100' : 'bg-slate-50 text-gray-800'}`}>
        
        {/* 主要內容區塊，保留底部 pb-20 以免被 Navbar 遮擋 */}
        <main className={`flex-1 w-full max-w-md mx-auto ${isLoggedIn ? 'pb-24 pt-4 px-4' : 'p-0'}`}>
          {!isLoggedIn && (
            <LiffLogin onLogin={handleLogin} toggleLang={toggleLang} toggleTheme={toggleTheme} lang={lang} isDark={isDark} t={t} liffProfile={liffProfile} isLiffInit={isLiffInit} />
          )}
          
          {isLoggedIn && currentTab === 'home' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900">{t.appTitle}</h1>
                {liffProfile && <img src={liffProfile.pictureUrl} alt="profile" className="w-10 h-10 rounded-full shadow-sm" />}
              </div>
              {userRole === 'admin' && <AdminDashboard />}
              {userRole === 'teacher' && <TeacherDashboard />}
              {userRole === 'parent' && <ParentDashboard />}
            </div>
          )}

          {isLoggedIn && currentTab === 'repairs' && (
             <div className="animate-fade-in">
               <RepairDashboard />
             </div>
          )}

          {isLoggedIn && currentTab === 'profile' && (
             <div className="animate-fade-in space-y-6">
               <h2 className="text-2xl font-extrabold text-gray-900 mb-6">個人設定</h2>
               
               <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                 {liffProfile ? (
                   <>
                    <img src={liffProfile.pictureUrl} className="w-20 h-20 rounded-full mx-auto mb-3 shadow-md" />
                    <h3 className="font-bold text-lg">{liffProfile.displayName}</h3>
                   </>
                 ) : (
                   <div className="w-20 h-20 rounded-full bg-gray-200 mx-auto mb-3 flex items-center justify-center text-gray-500">Demo</div>
                 )}
                 <p className="text-sm text-gray-500 mt-1">權限群組: {t[userRole]}</p>
               </div>

               <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
                 <button onClick={toggleLang} className="w-full text-left p-4 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all flex justify-between font-bold">
                   <span>切換語系 (Language)</span>
                   <span className="text-blue-500">{lang === 'zh' ? '中文' : 'English'}</span>
                 </button>
                 <button onClick={toggleTheme} className="w-full text-left p-4 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all flex justify-between font-bold">
                   <span>深色模式 (Dark Mode)</span>
                   <span className="text-blue-500">{isDark ? '開啟' : '關閉'}</span>
                 </button>
               </div>

               <button onClick={handleLogout} className="w-full py-4 bg-red-100 text-red-600 font-bold rounded-2xl shadow-sm active:scale-[0.98] transition-all">
                 登出系統
               </button>
             </div>
          )}
        </main>

        {/* 底部導覽列 (App-like Bottom Tab Bar) */}
        {isLoggedIn && (
          <nav className={`fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 flex justify-around items-center h-16 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-2xl px-2 z-50 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <button 
              onClick={() => setCurrentTab('home')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${currentTab === 'home' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <svg className="w-6 h-6" fill={currentTab === 'home' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              <span className="text-[10px] font-bold">首頁</span>
            </button>
            <button 
              onClick={() => setCurrentTab('repairs')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${currentTab === 'repairs' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <svg className="w-6 h-6" fill={currentTab === 'repairs' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="text-[10px] font-bold">報修</span>
            </button>
            <button 
              onClick={() => setCurrentTab('profile')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${currentTab === 'profile' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <svg className="w-6 h-6" fill={currentTab === 'profile' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <span className="text-[10px] font-bold">個人</span>
            </button>
          </nav>
        )}
      </div>
    </AppContext.Provider>
  );
}

export default App;
