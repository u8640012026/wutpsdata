import React, { useState } from 'react';
import liff from '@line/liff';
import { supabase } from '../supabaseClient';

export default function LiffLogin({ onLogin, toggleLang, toggleTheme, lang, isDark, t, liffProfile, isLiffInit }) {
  const [bindEmail, setBindEmail] = useState('');
  const [isBinding, setIsBinding] = useState(false);

  const handleLineLogin = () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const handleBind = async () => {
    if (!bindEmail || !liffProfile) return;
    setIsBinding(true);
    
    try {
      // 簡單的 Prototype 邏輯：直接將此信箱寫入或更新至 staff 資料表
      const { error } = await supabase.from('staff').upsert({
        email: bindEmail,
        name: liffProfile.displayName,
        title: bindEmail.includes('u864001') ? '行政' : '導師', // 根據信箱簡單判斷權限
        line_uid: liffProfile.userId
      }, { onConflict: 'email' });

      if (error) throw error;
      
      alert('綁定成功！請重新整理畫面。');
      window.location.reload();
    } catch (err) {
      alert('綁定失敗: ' + err.message);
      setIsBinding(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center relative">
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={toggleLang} className={`font-bold px-3 py-1.5 rounded-lg shadow-sm ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}`}>
          {lang === 'zh' ? 'EN' : 'ZH'}
        </button>
        <button onClick={toggleTheme} className={`p-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400' : 'bg-white hover:bg-gray-50 text-gray-600'}`}>
          {isDark ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
          )}
        </button>
      </div>

      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${isDark ? 'bg-blue-900' : 'bg-blue-100'}`}>
        <svg className={`w-10 h-10 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h1 className="text-3xl font-extrabold mb-2">{t.welcomeTitle}</h1>
      <p className={`mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.welcomeDesc}</p>

      {/* 真實 LINE 登入區塊 */}
      {isLiffInit && !liffProfile && (
        <button 
          onClick={handleLineLogin}
          className="w-full max-w-xs bg-[#06C755] hover:bg-[#05b34c] text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all mb-4 flex items-center justify-center"
        >
          <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.122.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.572-4.116 2.572-5.992z"/>
          </svg>
          使用 LINE 登入
        </button>
      )}

      {/* 為了今天簡報準備的展示入口 */}
      <div className={`mt-6 w-full max-w-xs p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
        <p className="text-sm font-bold text-gray-500 mb-3">🎓 簡報展示專區 (免登入)</p>
        <button 
          onClick={() => onLogin('teacher')}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-lg shadow transition-all flex items-center justify-center mb-2"
        >
          👨‍🏫 體驗導師版 (模擬假資料)
        </button>
        <div className="flex gap-2">
          <button onClick={() => onLogin('admin')} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-xs py-2 rounded">行政展示</button>
          <button onClick={() => onLogin('parent')} className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-xs py-2 rounded">家長展示</button>
        </div>
      </div>

      {/* 登入但尚未綁定的畫面 */}
      {liffProfile && (
        <div className={`w-full max-w-xs p-6 rounded-2xl border mt-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-xl'}`}>
          <img src={liffProfile.pictureUrl} alt="profile" className="w-16 h-16 rounded-full mx-auto mb-3" />
          <h3 className="font-bold mb-1">您好，{liffProfile.displayName}</h3>
          <p className="text-xs text-red-500 mb-4">系統找不到您的權限，請進行綁定</p>
          
          <input 
            type="email" 
            placeholder="請輸入教職員信箱 (例: u864001...)" 
            className="w-full p-2 text-sm border rounded mb-3 text-black"
            value={bindEmail}
            onChange={(e) => setBindEmail(e.target.value)}
          />
          <button 
            onClick={handleBind}
            disabled={isBinding}
            className="w-full bg-blue-500 text-white py-2 rounded font-bold"
          >
            {isBinding ? '綁定中...' : '確認綁定'}
          </button>
        </div>
      )}
    </div>
  );
}
