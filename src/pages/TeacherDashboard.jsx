import React, { useState } from 'react';
import StudentCard from '../components/StudentCard';
import { useApp } from '../App';

const mockStudents = [
  { id: '112001', name: '王小明', grade: '3', classNum: 'A', status: '在學', contact: '0912-345-678' },
  { id: '112002', name: '林美玲', grade: '3', classNum: 'A', status: '請假', contact: '0922-333-444' },
];

export default function TeacherDashboard() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const { isDark, t } = useApp();

  const textColor = isDark ? 'text-white' : 'text-gray-800';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-500';

  if (selectedStudent) {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => { setSelectedStudent(null); setIsEditing(false); }}
          className={`flex items-center font-semibold px-3 py-2 rounded-lg shadow-sm ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-600'}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t.goBack}
        </button>
        
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>{t.studentDetail}</h2>
          <p className={`text-sm ${subTextColor}`}>{selectedStudent.name} {t.profileOf}</p>
        </div>

        <StudentCard student={selectedStudent} />

        <div className={`rounded-xl shadow-sm p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h4 className={`font-bold ${textColor}`}>{t.contactStatus}</h4>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`text-sm px-3 py-1 rounded shadow-sm ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {isEditing ? t.cancelEdit : t.editProfile}
            </button>
          </div>
          
          <div className="space-y-4 text-sm">
            {isEditing ? (
              <>
                <div>
                  <label className={`text-xs block mb-1 ${subTextColor}`}>{t.contactPhone}</label>
                  <input type="text" defaultValue={selectedStudent.contact} className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`} />
                </div>
                <div>
                  <label className={`text-xs block mb-1 ${subTextColor}`}>{t.status}</label>
                  <select className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`}>
                    <option>{t.inSchool}</option>
                    <option>{t.onLeave}</option>
                  </select>
                </div>
                <button 
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded-lg mt-4 transition"
                  onClick={() => setIsEditing(false)}
                >
                  {t.saveChanges}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className={subTextColor}>{t.contactPhone}</span>
                  <span className={`font-medium ${textColor}`}>{selectedStudent.contact}</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>{t.emergencyContact}</span>
                  <span className={`font-medium ${textColor}`}>王爸爸</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>{t.currentStatus}</span>
                  <span className={`font-medium px-2 py-0.5 rounded ${selectedStudent.status === '在學' ? (isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700') : (isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700')}`}>
                    {selectedStudent.status === '在學' ? t.inSchool : t.onLeave}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className={`text-2xl font-bold ${textColor}`}>{t.teacherTitle}</h2>
        <p className={`text-sm ${subTextColor}`}>{t.teacherDesc}</p>
      </div>

      <section className="space-y-4">
        <h3 className={`text-lg font-bold ${textColor}`}>{t.studentList}</h3>
        
        <div className="grid gap-3">
          {mockStudents.map((student) => (
            <div 
              key={student.id} 
              className="cursor-pointer hover:shadow-md transition duration-200"
              onClick={() => setSelectedStudent(student)}
            >
              <StudentCard student={student} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
