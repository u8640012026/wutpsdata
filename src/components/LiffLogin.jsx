import React from 'react';

export default function LiffLogin({ onLogin, toggleLang, toggleTheme, lang, isDark, t }) {
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      
      <div className="absolute top-4 right-4 flex gap-3">
        <button onClick={toggleLang} className={`font-bold px-2 py-1 rounded ${isDark ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-gray-800'}`}>
          {lang === 'zh' ? 'EN' : 'ZH'}
        </button>
        <button onClick={toggleTheme} className={`p-1.5 rounded-full ${isDark ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-200 text-gray-600'}`}>
          {isDark ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
          )}
        </button>
      </div>

      <div className={`w-full max-w-sm rounded-xl shadow-md p-8 text-center space-y-6 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'}`}>
        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center text-3xl font-bold mb-2">
          通
        </div>
        <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.appTitle}</h1>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.loginDesc}</p>
        
        <div className="flex flex-col gap-3 mt-8">
          <button 
            onClick={() => onLogin('admin')}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg shadow transition"
          >
            {t.loginAdmin}
          </button>
          
          <button 
            onClick={() => onLogin('teacher')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg shadow transition"
          >
            {t.loginTeacher}
          </button>
          
          <button 
            onClick={() => onLogin('parent')}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg shadow transition"
          >
            {t.loginParent}
          </button>
        </div>
      </div>
    </div>
  );
}
