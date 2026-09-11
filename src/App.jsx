import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import LiffLogin from './components/LiffLogin';
import AdminDashboard from './pages/AdminDashboard';
import ParentDashboard from './pages/ParentDashboard';
import RepairDashboard from './pages/RepairDashboard';
import PublicShareView from './components/PublicShareView';
import { translations } from './i18n';
import liff from '@line/liff';
import { isSuperAdmin, canManageRepairs } from './lib/staffAccess';
import { getReadMentions, isMentioned } from './lib/mentionHelper';
import { LayoutDashboard, Wrench, Sun, Moon, Languages, LogOut, User, ChevronDown } from 'lucide-react';

export const AppContext = createContext();
export const useApp = () => useContext(AppContext);

const LIFF_ID = '2011376584-Ia2rhpXU';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [lang, setLang] = useState('zh');
  const [isDark, setIsDark] = useState(false);
  const [currentTab, setCurrentTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [liffProfile, setLiffProfile] = useState(null);
  const [isLiffInit, setIsLiffInit] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [publicRoute] = useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const view = searchParams.get('view');
      const id = searchParams.get('id');
      if (view && id && ['announcement', 'repair'].includes(view)) {
        return { view, id };
      }
    }
    return null;
  });

  const t = translations[lang];

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    liff.init({ liffId: LIFF_ID }).then(() => {
      setIsLiffInit(true);
      if (liff.isLoggedIn()) {
        liff.getProfile().then(profile => {
          setLiffProfile(profile);
          checkUserRole(profile.userId);
        });
      } else {
        setIsCheckingRole(false);
      }
    }).catch(err => {
      console.error('LIFF init failed', err);
      setIsCheckingRole(false);
    });
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
    } finally {
      setIsCheckingRole(false);
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
    setMenuOpen(false);
  };

  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [repairBadgeCount, setRepairBadgeCount] = useState(0);
  const [adminBadgeCount, setAdminBadgeCount] = useState(0);

  const fetchRepairBadge = useCallback(async (uid, staff) => {
    if (!uid) return;
    try {
      const res = await fetch('/api/repairs', { headers: { 'x-line-uid': uid } });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        const isMgr = canManageRepairs(staff);
        if (isMgr) {
          const count = data.filter(r => r.status !== 'closed').length;
          setRepairBadgeCount(count);
        } else {
          const count = data.filter(r => r.status === 'completed' && r.reporter_uid === uid).length;
          setRepairBadgeCount(count);
        }
      }
    } catch {
      // 靜默容錯，不影響使用者介面
    }
  }, []);

  const fetchAdminBadge = useCallback(async (userName) => {
    if (!userName || userName === '未知使用者') {
      setAdminBadgeCount(0);
      return;
    }
    try {
      const readSet = getReadMentions();
      let unread = 0;

      // 1. 公告提及檢查
      const annRes = await fetch('/api/announcements?archived=false');
      if (annRes.ok) {
        const anns = await annRes.json();
        if (Array.isArray(anns)) {
          anns.forEach(a => {
            const key = `announcement:${a.id}`;
            if (isMentioned(`${a.title} ${a.content || ''}`, userName) && !readSet.has(key)) {
              unread++;
            }
          });
        }
      }

      // 2. 行事曆活動提及檢查
      const calRes = await fetch('/api/calendar?type=all');
      if (calRes.ok) {
        const calData = await calRes.json();
        if (calData.status === 'success' && Array.isArray(calData.data)) {
          calData.data.forEach(ev => {
            const key = `calendar:${ev.id}`;
            if (isMentioned(`${ev.title} ${ev.description || ''}`, userName) && !readSet.has(key)) {
              unread++;
            }
          });
        }
      }

      setAdminBadgeCount(unread);
    } catch {
      // 靜默容錯
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const uid = liffProfile?.userId || 'dev-admin';
      const userName = staffData?.name || liffProfile?.displayName;
      fetchRepairBadge(uid, staffData);
      fetchAdminBadge(userName);
    }
  }, [isLoggedIn, liffProfile, staffData, fetchRepairBadge, fetchAdminBadge]);

  useEffect(() => {
    const handleMentionRead = () => {
      const userName = staffData?.name || liffProfile?.displayName;
      fetchAdminBadge(userName);
    };
    window.addEventListener('wutps-mention-read', handleMentionRead);
    return () => window.removeEventListener('wutps-mention-read', handleMentionRead);
  }, [staffData, liffProfile, fetchAdminBadge]);

  const toggleTheme = () => setIsDark(!isDark);
  const toggleLang = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const contextValue = { 
    lang, isDark, t, handleLogout, liffProfile, staffData, userRole, 
    hideBottomNav, setHideBottomNav, 
    repairBadgeCount, setRepairBadgeCount, fetchRepairBadge,
    adminBadgeCount, setAdminBadgeCount, fetchAdminBadge
  };

  if (publicRoute) {
    return (
      <PublicShareView
        view={publicRoute.view}
        id={publicRoute.id}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className={`min-h-[100dvh] flex flex-col ${isDark ? 'dark bg-slate-950 text-stone-100' : 'bg-stone-50 text-stone-900'}`}>

        {/* ── 頂部 Header（毛玻璃固定）── */}
        {isLoggedIn && (
          <header className={`fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b backdrop-blur-md ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-stone-200'}`}>
            {/* 左：品牌標識 */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard size={14} className="text-white" />
              </div>
              <span className={`font-extrabold text-sm tracking-tight ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>霧小校務系統</span>
            </div>

            {/* 右：功能按鈕群 */}
            <div className="flex items-center gap-2">
              {/* 語系切換膠囊 */}
              <button
                onClick={toggleLang}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${isDark ? 'border-slate-700 text-stone-300 hover:bg-slate-800' : 'border-stone-200 text-stone-600 hover:bg-stone-100'}`}
              >
                <Languages size={12} />
                {lang === 'zh' ? 'EN' : '中'}
              </button>

              {/* 日夜切換 */}
              <button
                onClick={toggleTheme}
                className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${isDark ? 'border-slate-700 text-amber-400 hover:bg-slate-800' : 'border-stone-200 text-stone-600 hover:bg-stone-100'}`}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* 個人頭像 + 下拉選單 */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1"
                >
                  {liffProfile
                    ? <img src={liffProfile.pictureUrl} alt="profile" className="w-8 h-8 rounded-full border-2 border-emerald-500 object-cover" />
                    : <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-emerald-500 ${isDark ? 'bg-slate-700' : 'bg-stone-100'}`}><User size={15} /></div>
                  }
                  <ChevronDown size={12} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''} ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                </button>

                {/* 下拉卡片 */}
                {menuOpen && (
                  <div className={`absolute right-0 top-11 w-56 rounded-xl shadow-2xl border overflow-hidden z-[100] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-stone-200'}`}>
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-800 bg-slate-800/50' : 'border-stone-100 bg-stone-50'}`}>
                      <p className={`font-bold text-sm truncate ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
                        {liffProfile?.displayName || staffData?.name || 'Demo 模式'}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
                        {staffData?.department ? `${staffData.department} · ${staffData.title || ''}` : (staffData?.title || t[userRole] || '')}
                      </p>
                      {isSuperAdmin(staffData) && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            最高權限 (Role 0)
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 transition-colors ${isDark ? 'hover:bg-red-950/30' : 'hover:bg-red-50'}`}
                    >
                      <LogOut size={15} />
                      登出系統
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        {/* ── 主內容區（Header 高 3.5rem + 8px 間距 = pt-[60px]）── */}
        <main className={`flex-1 w-full mx-auto ${isLoggedIn ? `max-w-6xl ${hideBottomNav ? 'pb-8' : 'pb-24'} pt-[60px] px-4 sm:px-8` : 'max-w-md p-0'}`}>

          {isCheckingRole && (
            <div className="flex flex-col items-center justify-center min-h-[100dvh]">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-emerald-700 font-bold animate-pulse">正在驗證身分...</p>
            </div>
          )}

          {!isCheckingRole && !isLoggedIn && (
            <LiffLogin onLogin={handleLogin} toggleLang={toggleLang} toggleTheme={toggleTheme} lang={lang} isDark={isDark} t={t} liffProfile={liffProfile} isLiffInit={isLiffInit} />
          )}

          {!isCheckingRole && isLoggedIn && currentTab === 'home' && (
            <div className="animate-fade-in">
              {(userRole === 'admin' || userRole === 'teacher') && <AdminDashboard />}
              {userRole === 'parent' && <ParentDashboard />}
            </div>
          )}

          {isLoggedIn && currentTab === 'repairs' && (
            <div className="animate-fade-in">
              <RepairDashboard />
            </div>
          )}
        </main>

        {/* ── 底部導覽列（毛玻璃，全寬，僅 2 個分頁，進入二層子頁自動隱藏，避免遮擋按鈕）── */}
        {isLoggedIn && !hideBottomNav && (
          <nav className={`fixed bottom-0 left-0 right-0 z-40 h-16 flex justify-around items-center border-t backdrop-blur-md transition-all ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-stone-200'}`}>
            <button
              onClick={() => setCurrentTab('home')}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all active:scale-95 ${currentTab === 'home' ? 'text-emerald-700 dark:text-emerald-400' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <div className="relative">
                <LayoutDashboard size={22} strokeWidth={currentTab === 'home' ? 2.5 : 1.5} />
                {adminBadgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-pulse">
                    {adminBadgeCount > 99 ? '99+' : adminBadgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">校務行政</span>
            </button>

            <button
              onClick={() => setCurrentTab('repairs')}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all active:scale-95 ${currentTab === 'repairs' ? 'text-emerald-700 dark:text-emerald-400' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <div className="relative">
                <Wrench size={22} strokeWidth={currentTab === 'repairs' ? 2.5 : 1.5} />
                {repairBadgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-pulse">
                    {repairBadgeCount > 99 ? '99+' : repairBadgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold">修繕採購</span>
            </button>
          </nav>
        )}

      </div>
    </AppContext.Provider>
  );
}

export default App;


