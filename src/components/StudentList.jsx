import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import liff from '@line/liff';

export default function StudentList() {
  const { isDark } = useApp();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 篩選與顯示狀態
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [showHomeschooled, setShowHomeschooled] = useState(false);
  
  // 展開的學生與頁籤
  const [expandedStudent, setExpandedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('basic'); // basic, family, indigenous, english, status, funding, other

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
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  // 取得不重複的年級與班級清單供下拉選單使用
  const grades = [...new Set(students.map(s => s.grade))].filter(Boolean).sort();
  const classes = [...new Set(students.filter(s => selectedGrade === 'all' || s.grade === selectedGrade).map(s => s.class_name))].filter(Boolean).sort();

  // 過濾學生名單
  const filteredStudents = students.filter(s => {
    if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
    if (selectedClass !== 'all' && s.class_name !== selectedClass) return false;
    
    const isHomeschooled = s.enroll_type?.includes('自學') || s.enroll_type?.includes('在家');
    if (!showHomeschooled && isHomeschooled) return false;
    
    return true;
  });

  const cardBg = isDark ? 'bg-slate-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';

  const renderStudentDetails = (student) => {
    const details = student.details || {};
    
    // 預先分類 Excel 來的標籤
    const familyKeys = Object.keys(details).filter(k => k.includes('親') || k.includes('電話') || k.includes('地址') || k.includes('監護人') || k.includes('緊急'));
    const indigKeys = Object.keys(details).filter(k => k.includes('族語') || k.includes('原住民') || k.includes('母語'));
    const englishKeys = Object.keys(details).filter(k => k.includes('英') || k.includes('外語'));
    const statusKeys = Object.keys(details).filter(k => k.includes('身分') || k.includes('特教') || k.includes('輔導') || k.includes('障礙') || k.includes('低收'));
    const fundingKeys = Object.keys(details).filter(k => k.includes('費') || k.includes('補助') || k.includes('獎學金'));
    
    const usedKeys = new Set([...familyKeys, ...indigKeys, ...englishKeys, ...statusKeys, ...fundingKeys]);
    const otherKeys = Object.keys(details).filter(k => !usedKeys.has(k));

    const renderKeyValue = (keys) => {
      if (keys.length === 0) return <p className="text-gray-400 text-sm italic">無相關資料</p>;
      return (
        <div className="grid grid-cols-1 gap-2">
          {keys.map(k => (
            <div key={k} className={`flex justify-between items-center p-2 rounded ${isDark ? 'bg-slate-700' : 'bg-stone-50'}`}>
              <span className="text-sm font-bold text-gray-500">{k}</span>
              <span className={`text-sm ${textColor}`}>{details[k]}</span>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className={`mt-3 border-t pt-3 ${isDark ? 'border-slate-600' : 'border-gray-200'}`}>
        {/* 頁籤選單 */}
        <div className="flex overflow-x-auto space-x-2 pb-2 mb-3 scrollbar-hide">
          {['basic:基本', 'family:家庭', 'indigenous:族語', 'english:英語', 'status:身分', 'funding:經費', 'other:其他'].map(tab => {
            const [id, label] = tab.split(':');
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  activeTab === id 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : isDark ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* 頁籤內容 */}
        <div className="animate-fade-in">
          {activeTab === 'basic' && (
             <div className="grid grid-cols-1 gap-2">
               <div className={`flex justify-between p-2 rounded ${isDark ? 'bg-slate-700' : 'bg-stone-50'}`}><span className="text-sm font-bold text-gray-500">學號</span><span className={`text-sm ${textColor}`}>{student.student_id}</span></div>
               <div className={`flex justify-between p-2 rounded ${isDark ? 'bg-slate-700' : 'bg-stone-50'}`}><span className="text-sm font-bold text-gray-500">年級班級</span><span className={`text-sm ${textColor}`}>{student.grade} 年 {student.class_name} 班</span></div>
               <div className={`flex justify-between p-2 rounded ${isDark ? 'bg-slate-700' : 'bg-stone-50'}`}><span className="text-sm font-bold text-gray-500">座號</span><span className={`text-sm ${textColor}`}>{student.seat_number}</span></div>
               <div className={`flex justify-between p-2 rounded ${isDark ? 'bg-slate-700' : 'bg-stone-50'}`}><span className="text-sm font-bold text-gray-500">就學狀態</span><span className={`text-sm ${textColor}`}>{student.enroll_type}</span></div>
             </div>
          )}
          {activeTab === 'family' && renderKeyValue(familyKeys)}
          {activeTab === 'indigenous' && renderKeyValue(indigKeys)}
          {activeTab === 'english' && renderKeyValue(englishKeys)}
          {activeTab === 'status' && renderKeyValue(statusKeys)}
          {activeTab === 'funding' && renderKeyValue(fundingKeys)}
          {activeTab === 'other' && renderKeyValue(otherKeys)}
        </div>
      </div>
    );
  };

  return (
    <div className={`rounded-xl shadow-sm p-4 ${cardBg}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className={`text-lg font-bold ${textColor}`}>🧑‍🎓 全校學生總覽</h3>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
          共 {filteredStudents.length} 筆
        </span>
      </div>

      {/* 控制列 */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <select 
            value={selectedGrade} 
            onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass('all'); }}
            className={`flex-1 text-sm p-2 rounded-lg outline-none font-bold ${isDark ? 'bg-slate-700 text-white' : 'bg-stone-100 text-gray-800'}`}
          >
            <option value="all">所有年級</option>
            {grades.map(g => <option key={g} value={g}>{g} 年級</option>)}
          </select>
          
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)}
            className={`flex-1 text-sm p-2 rounded-lg outline-none font-bold ${isDark ? 'bg-slate-700 text-white' : 'bg-stone-100 text-gray-800'}`}
          >
            <option value="all">所有班級</option>
            {classes.map(c => <option key={c} value={c}>{c} 班</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer p-2 bg-stone-100 dark:bg-slate-700 rounded-lg">
          <input 
            type="checkbox" 
            checked={showHomeschooled} 
            onChange={(e) => setShowHomeschooled(e.target.checked)} 
            className="w-4 h-4 text-emerald-600 rounded"
          />
          <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>顯示已隱藏的「在家自學」學生</span>
        </label>
      </div>

      {/* 學生列表 */}
      {isLoading ? (
        <p className="text-gray-500 text-center py-8 font-bold animate-pulse">載入學生資料中...</p>
      ) : filteredStudents.length === 0 ? (
        <p className="text-gray-500 text-center py-8">找不到符合條件的學生</p>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map(student => (
            <div key={student.student_id} className={`border rounded-xl overflow-hidden transition-colors ${isDark ? 'border-slate-700 bg-slate-900' : 'border-stone-200 bg-white'}`}>
              <button 
                onClick={() => {
                  setExpandedStudent(expandedStudent === student.student_id ? null : student.student_id);
                  setActiveTab('basic');
                }}
                className={`w-full flex items-center justify-between p-3 active:scale-[0.99] transition-transform ${isDark ? 'hover:bg-slate-800' : 'hover:bg-stone-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-lg">
                    {student.seat_number}
                  </div>
                  <div className="text-left">
                    <h4 className={`font-extrabold ${textColor}`}>{student.name}</h4>
                    <p className="text-xs text-gray-500">{student.grade}年{student.class_name}班 / 學號: {student.student_id}</p>
                  </div>
                </div>
                <div>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedStudent === student.student_id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedStudent === student.student_id && (
                <div className="px-3 pb-3">
                  {renderStudentDetails(student)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
