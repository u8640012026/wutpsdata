import React, { useState } from 'react';
import StudentCard from '../components/StudentCard';
import BulletinBoard from '../components/BulletinBoard';
import { useApp } from '../App';

const mockStudents = [
  { id: '112001', name: '王小明', grade: '3', classNum: 'A', status: '在學', enrollType: '在', contact: '0912-345-678', idNumber: 'A123456789', address: '台北市某某區', parent: '王大明', specialCondition: '' },
  { id: '112002', name: '林美玲', grade: '3', classNum: 'A', status: '請假', enrollType: '在', contact: '0922-333-444', idNumber: 'F223456789', address: '', parent: '林媽媽', specialCondition: '氣喘' },
  { id: '112003', name: '陳小豪', grade: '3', classNum: 'A', status: '在學', enrollType: '自', contact: '', idNumber: '', address: '在家自學地址', parent: '陳爸爸', specialCondition: '' },
];

export default function TeacherDashboard() {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showHomeschooled, setShowHomeschooled] = useState(false);
  const { isDark, t } = useApp();

  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-300' : 'text-stone-600';

  const displayedStudents = mockStudents.filter(s => showHomeschooled || s.enrollType === '在');

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
          <h2 className={`text-2xl font-bold ${textColor}`}>{t.studentDetail} {selectedStudent.enrollType === '自' && <span className="text-sm bg-orange-100 text-orange-600 px-2 py-1 rounded ml-2">在家自學</span>}</h2>
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
                  <label className={`text-xs block mb-1 ${subTextColor}`}>就讀狀態</label>
                  <select className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`} defaultValue={selectedStudent.enrollType}>
                    <option value="在">在學</option>
                    <option value="自">在家自學</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs block mb-1 ${subTextColor}`}>{t.contactPhone}</label>
                  <input type="text" defaultValue={selectedStudent.contact} className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}`} />
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
                  <span className={subTextColor}>身分證字號</span>
                  <span className={`font-medium ${textColor}`}>{selectedStudent.idNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>家長姓名</span>
                  <span className={`font-medium ${textColor}`}>{selectedStudent.parent || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>{t.contactPhone}</span>
                  <span className={`font-medium ${textColor}`}>{selectedStudent.contact || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>通訊地址</span>
                  <span className={`font-medium ${textColor}`}>{selectedStudent.address || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={subTextColor}>特殊病況</span>
                  <span className={`font-medium ${selectedStudent.specialCondition ? 'text-red-500' : textColor}`}>{selectedStudent.specialCondition || '無'}</span>
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

      <BulletinBoard />

      <section className="space-y-4 mt-6">
        <div className="flex justify-between items-center">
          <h3 className={`text-lg font-bold ${textColor}`}>{t.studentList}</h3>
          <label className="flex items-center space-x-2 text-sm cursor-pointer">
            <input 
              type="checkbox" 
              checked={showHomeschooled} 
              onChange={(e) => setShowHomeschooled(e.target.checked)}
              className="rounded text-blue-500 focus:ring-blue-500"
            />
            <span className={subTextColor}>顯示在家自學生</span>
          </label>
        </div>
        
        <div className="grid gap-3">
          {displayedStudents.map((student) => (
            <div 
              key={student.id} 
              className={`cursor-pointer hover:shadow-md transition duration-200 rounded-xl ${student.enrollType === '自' ? 'opacity-75 border-2 border-dashed border-orange-200' : ''}`}
              onClick={() => setSelectedStudent(student)}
            >
              <StudentCard student={student} />
              {student.enrollType === '自' && <div className="text-center text-xs text-orange-500 bg-orange-50 py-1 rounded-b-xl">此為在家自學生，不列入一般統計</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
