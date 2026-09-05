import React, { useState } from 'react';
import StudentCard from '../components/StudentCard';
import Timeline from '../components/Timeline';
import { useApp } from '../App';

const mockChildren = [
  { 
    id: '112001', name: '王小明', grade: '3', classNum: 'A', status: '在學',
    events: [
      { date: '2023-11-15', title: '期中考 (3年級)', description: '國語、數學' },
      { date: '2023-11-20', title: '班級同樂會', description: '請準備一份零食' }
    ]
  },
  { 
    id: '109023', name: '王大明', grade: '6', classNum: 'C', status: '在學',
    events: [
      { date: '2023-11-15', title: '期中考 (6年級)', description: '全科' },
      { date: '2023-12-01', title: '畢業旅行', description: '三天兩夜' }
    ]
  },
];

export default function ParentDashboard() {
  const [selectedChildId, setSelectedChildId] = useState(mockChildren[0].id);
  const { isDark, t } = useApp();

  const selectedChild = mockChildren.find(c => c.id === selectedChildId);
  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-300' : 'text-stone-600';

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className={`text-2xl font-bold ${textColor}`}>{t.parentTitle}</h2>
        <p className={`text-sm ${subTextColor}`}>{t.parentDesc}</p>
      </div>

      {/* 多子女切換選單 */}
      <div className={`p-3 rounded-lg shadow-sm ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <label className={`text-xs block mb-1 ${subTextColor}`}>{t.switchChild}</label>
        <select 
          className={`w-full p-2 border rounded font-medium outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
          value={selectedChildId}
          onChange={(e) => setSelectedChildId(e.target.value)}
        >
          {mockChildren.map(child => (
            <option key={child.id} value={child.id}>
              {child.name} ({child.grade}年{child.classNum}班)
            </option>
          ))}
        </select>
      </div>

      <section>
        <StudentCard student={selectedChild} />
      </section>

      <section className={`rounded-xl shadow-sm p-4 mt-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-bold border-b pb-2 mb-4 ${textColor} ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {selectedChild.name} {t.recentCalendar}
        </h3>
        <Timeline events={selectedChild.events} />
      </section>
    </div>
  );
}
