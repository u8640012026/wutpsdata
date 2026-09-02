import React, { useState, useEffect } from 'react';
import liff from '@line/liff';

export default function LiffLogin({ onLogin, toggleLang, toggleTheme, lang, isDark, t, liffProfile, isLiffInit }) {
  const [bindEmail, setBindEmail] = useState('');
  const [isBinding, setIsBinding] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // 檢查網址是否有 ?dev=true 來開啟開發者模式
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === 'true') {
      setIsDev(true);
    }
  }, []);

  const handleLineLogin = () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const handleBind = async () => {
    if (!hasAgreed) {
      alert('請先閱讀並勾選同意隱私權條款');
      return;
    }
    if (!bindEmail || !liffProfile) return;
    setIsBinding(true);
    
    try {
      const response = await fetch('/api/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: bindEmail,
          displayName: liffProfile.displayName,
          userId: liffProfile.userId
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '未知的錯誤');
      
      alert('綁定成功！請重新整理畫面。');
      window.location.reload();
    } catch (err) {
      alert('綁定失敗: ' + err.message);
      setIsBinding(false);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[100dvh] px-4 py-8 relative ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
      {/* 頂部控制按鈕 (語系/深色模式) */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={toggleLang} className={`font-bold px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}`}>
          {lang === 'zh' ? 'EN' : 'ZH'}
        </button>
        <button onClick={toggleTheme} className={`p-2 rounded-full shadow-sm active:scale-95 transition-transform ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400' : 'bg-white hover:bg-gray-100 text-gray-600'}`}>
          {isDark ? '🌙' : '☀️'}
        </button>
      </div>

      <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-md ${isDark ? 'bg-blue-900' : 'bg-blue-500'}`}>
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h1 className="text-3xl font-extrabold mb-2">{t.welcomeTitle}</h1>
      <p className={`mb-10 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.welcomeDesc}</p>

      {/* 真實 LINE 登入區塊 (若尚未登入 LINE) */}
      {isLiffInit && !liffProfile && (
        <button 
          onClick={handleLineLogin}
          className="w-full max-w-xs bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3.5 px-6 rounded-2xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center"
        >
          <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.122.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.572-4.116 2.572-5.992z"/>
          </svg>
          使用 LINE 登入
        </button>
      )}

      {/* 登入 LINE 但尚未綁定的畫面 (加入隱私權同意書) */}
      {liffProfile && (
        <div className={`w-full max-w-sm p-6 rounded-3xl shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
          <img src={liffProfile.pictureUrl} alt="profile" className="w-16 h-16 rounded-full mx-auto mb-3 shadow-sm border-2 border-white" />
          <h3 className="font-bold text-lg text-center mb-1">您好，{liffProfile.displayName}</h3>
          <p className="text-xs text-center text-blue-500 mb-4 bg-blue-50 p-2 rounded-lg">這是您首次登入，請完成教職員信箱綁定以開通權限。</p>
          
          {/* 個資同意書區塊 */}
          <div className={`h-32 overflow-y-auto p-3 text-xs mb-4 rounded-xl border ${isDark ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">資料處理與隱私權同意書 (DPA)</h4>
            <p>1. 本系統將蒐集您的 LINE 內部識別碼與電子信箱，僅作為校內身分認證之用。</p>
            <p>2. 您的連線操作將被記錄於系統日誌中，以符合教育部資安稽核規範。</p>
            <p>3. 系統伺服器使用合規之雲端架構，確保您的資料受到國際級安全加密保護。</p>
            <p>4. 點擊同意即代表您允許本系統處理並儲存上述必要資訊。</p>
          </div>

          <label className="flex items-center gap-2 mb-6 cursor-pointer">
            <input 
              type="checkbox" 
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
            />
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>我已閱讀並同意隱私權政策</span>
          </label>
          
          <div className="space-y-3">
            <input 
              type="email" 
              placeholder="請輸入教職員信箱 (例: u864001@...)" 
              className={`w-full p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${isDark ? 'bg-gray-900 text-white placeholder-gray-500' : 'bg-gray-100 text-gray-900 placeholder-gray-400'}`}
              value={bindEmail}
              onChange={(e) => setBindEmail(e.target.value)}
              disabled={!hasAgreed}
            />
            <button 
              onClick={handleBind}
              disabled={isBinding || !hasAgreed || !bindEmail}
              className={`w-full py-3.5 rounded-xl font-bold active:scale-[0.98] transition-all ${
                hasAgreed && bindEmail 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isBinding ? '綁定中...' : '確認綁定'}
            </button>
          </div>
        </div>
      )}

      {/* 開發者展示區塊 (僅在 ?dev=true 時顯示) */}
      {isDev && (
        <div className={`mt-8 w-full max-w-xs p-4 rounded-2xl border-2 border-dashed ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-bold text-red-500">🔧 開發者測試區</p>
          </div>
          <button 
            onClick={() => onLogin('teacher')}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-transform mb-2 text-sm"
          >
            👨‍🏫 體驗導師版 (模擬)
          </button>
          <div className="flex gap-2">
            <button onClick={() => onLogin('admin')} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-xs py-2 rounded-lg active:scale-95 transition-transform">行政展示</button>
            <button onClick={() => onLogin('parent')} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-xs py-2 rounded-lg active:scale-95 transition-transform">家長展示</button>
          </div>
        </div>
      )}
    </div>
  );
}
