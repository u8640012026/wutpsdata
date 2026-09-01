import React from 'react';
import { useApp } from '../App';

export default function StudentCard({ student }) {
  const { isDark, t, lang } = useApp();
  if (!student) return null;

  // We can add simple name map logic if needed, but for mock let's just keep the original name
  return (
    <div className={`rounded-xl shadow-sm border p-4 flex items-center space-x-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-lg flex-shrink-0">
        {student.name ? student.name.charAt(0) : '?'}
      </div>
      <div className="flex-1">
        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{student.name}</h3>
        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {lang === 'en' ? `Grade ${student.grade} Class ${student.classNum} | ID: ${student.id}` : `${student.grade}年${student.classNum}班 | 學號: ${student.id}`}
        </p>
      </div>
      {student.status && (
        <div className={`flex-shrink-0 px-2 py-1 text-xs rounded-full ${student.status === '在學' ? (isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700') : (isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700')}`}>
          {student.status === '在學' ? t.inSchool : t.onLeave}
        </div>
      )}
    </div>
  );
}
