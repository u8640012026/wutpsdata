import React, { useState } from 'react';
import Timeline from '../components/Timeline';
import { useApp } from '../App';
import * as XLSX from 'xlsx';
import liff from '@line/liff';
import { supabase } from '../supabaseClient';
import RepairDashboard from './RepairDashboard';
import StaffList from '../components/StaffList';
import StudentList from '../components/StudentList';
import BulletinBoard from '../components/BulletinBoard';
import TimetableViewer from '../components/TimetableViewer';
import SchoolBrain from '../components/SchoolBrain';
import { 
  Calendar, 
  GraduationCap, 
  Users, 
  Database, 
  ShieldCheck, 
  ArrowLeft, 
  UploadCloud, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Megaphone,
  School,
  Layers,
  BrainCircuit,
  Sparkles,
  Download,
  FileSpreadsheet,
  Settings,
  HardDrive
} from 'lucide-react';

const mockEvents = [
  { date: '2023-11-01', title: '全校運動會 / Sports Day', description: '請全體師生準時於操場集合 / Gather at the field' },
  { date: '2023-11-15', title: '期中考 / Midterm', description: '期中評量 / Midterm exams' },
];

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'calendar', 'students', 'timetable', 'superadmin'
  const [superadminTab, setSuperadminTab] = useState('whitelist'); // 'whitelist', 'import', 'backup'
  const [isEditing, setIsEditing] = useState(false);
  const [events, setEvents] = useState(mockEvents);
  const { isDark, t, staffData } = useApp();
  
  const [uploadStatus, setUploadStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');

  const isSuperAdmin = staffData?.role_tags?.includes('0') || staffData?.email?.includes('u864001');
  const canAccessBrain = ['0', '1', '2', '3'].some(r => staffData?.role_tags?.includes(r)) || isSuperAdmin;

  const handleStudentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setUploadStatus('正在讀取 Excel 檔案...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setUploadStatus(`檔案讀取成功，共 ${data.length} 筆資料。開始上傳至資料庫...`);

        const formattedData = data.map(row => {
          const { 學號, 姓名, 年級, 班級, 座號, 在學或自學, 父親電話, 母親電話, ...otherDetails } = row;
          return {
            student_id: String(學號 || row.student_id || ''),
            name: String(姓名 || row.name || ''),
            grade: String(年級 || row.grade || ''),
            class_name: String(班級 || row.class_name || ''),
            seat_number: 座號 ? Number(座號) : (row.seat_number ? Number(row.seat_number) : null),
            enrollment_type: String(在學或自學 || row.enrollment_type || '在'),
            father_phone: String(父親電話 || row.father_phone || ''),
            mother_phone: String(母親電話 || row.mother_phone || ''),
            details: otherDetails
          };
        }).filter(item => item.student_id && item.name);

        if (formattedData.length === 0) {
          throw new Error('未在 Excel 中找到符合格式的學生資料（需包含學號與姓名欄位）');
        }

        const response = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_uid: liff.isLoggedIn() ? (await liff.getProfile()).userId : 'dev-admin',
            studentsData: formattedData
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '未知的錯誤');
        
        setUploadStatus(`成功匯入 ${result.count} 筆學生資料！(並已寫入安全日誌)`);
      } catch (err) {
        console.error(err);
        setUploadStatus(`上傳失敗: ${err.message}`);
      } finally {
        setIsLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStaffUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsLoading(true);
    setUploadStatus('讀取教職員 Excel 檔案中...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setUploadStatus(`檔案讀取成功，共 ${data.length} 筆資料。開始寫入資料庫...`);

        const formattedData = data.map(rawRow => {
          const row = {};
          for (let key in rawRow) {
            row[key.trim()] = rawRow[key];
          }
          
          return {
            name: row['姓名'] || row.name || '未知',
            department: row['處室'] || row.department || '',
            title: row['職稱'] || row.title || '',
            class_assigned: row['任教班級'] || row.class_assigned || '',
            email: String(row['電子信箱'] || row.email || '').trim(),
            role_tags: String(row['角色標籤'] || row.role_tags || '')
          };
        }).filter(item => item.email);

        if (formattedData.length === 0) {
          throw new Error('未找到有效資料，請確保包含「電子信箱」欄位');
        }

        const response = await fetch('/api/staff_import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_uid: liff.isLoggedIn() ? (await liff.getProfile()).userId : 'dev-admin',
            staffData: formattedData
          })
        });

        const result = await response.json();
        if (response.ok) {
          setUploadStatus(`成功更新 ${result.count} 筆教職員資料！(原綁定資料已自動保留)`);
        } else {
          setUploadStatus(`錯誤: ${result.error}`);
        }
      } catch (err) {
        setUploadStatus(`解析失敗: ${err.message}`);
      } finally {
        setIsLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  // 一鍵匯出資料庫冷備份 JSON
  const handleExportBackup = async () => {
    setBackupStatus('正在產出全校資料庫備份檔...');
    try {
      let uid = 'dev-admin';
      if (liff.isLoggedIn()) {
        const p = await liff.getProfile();
        uid = p.userId;
      }

      // 取得教職員
      const staffRes = await fetch('/api/staff', { headers: { 'x-line-uid': uid } });
      const staffList = staffRes.ok ? await staffRes.json() : [];

      // 取得學生
      const stuRes = await fetch('/api/students', { headers: { 'x-line-uid': uid } });
      const stuList = stuRes.ok ? await stuRes.json() : [];

      const backupPackage = {
        school: '屏東縣霧臺國小',
        backup_date: new Date().toISOString(),
        exported_by: staffData?.name || uid,
        counts: {
          staff: staffList.length,
          students: stuList.length
        },
        staff: staffList,
        students: stuList
      };

      const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `霧臺國小全校校務資料庫備份_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStatus('備份檔產出成功！已自動下載至您的裝置中。');
    } catch (err) {
      console.error(err);
      setBackupStatus('備份產出失敗: ' + err.message);
    }
  };

  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-300' : 'text-stone-600';
  const cardBg = isDark ? 'bg-slate-900' : 'bg-white';

  // ── 課表檢視頁 ──
  if (currentView === 'timetable') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors ${
            isDark ? 'bg-slate-800 text-teal-400 hover:bg-slate-700' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          <ArrowLeft size={16} className="mr-1.5" />
          {t.goBack}
        </button>

        <div>
          <h2 className={`text-2xl font-black tracking-tight ${textColor}`}>全校教師授課總課表</h2>
          <p className={`text-sm mt-0.5 ${subTextColor}`}>屏東縣霧臺國小 115 學年度 · 支援霧臺校區與勵古百合分校雙校區切換</p>
        </div>

        <TimetableViewer pdfUrl="/timetable.pdf" />
      </div>
    );
  }

  // ── 行事曆檢視頁 ──
  if (currentView === 'calendar') {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setCurrentView('menu')}
            className={`flex items-center font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors ${
              isDark ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <ArrowLeft size={16} className="mr-1.5" />
            {t.goBack}
          </button>
          
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
              isEditing 
                ? 'bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-stone-300' 
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isEditing ? t.finishView : t.editMode}
          </button>
        </div>

        <section className={`rounded-2xl shadow-sm p-5 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          {isEditing && (
            <div className={`mb-6 p-4 rounded-xl border border-dashed ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-amber-50/50 border-amber-200'}`}>
              <h4 className={`text-sm font-bold mb-3 ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>{t.addEvent}</h4>
              <div className="space-y-3">
                <input type="date" className={`w-full text-sm p-3 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'}`} />
                <input type="text" placeholder={t.eventTitle} className={`w-full text-sm p-3 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-white border-stone-300 text-stone-900'}`} />
                <button className={`w-full font-bold py-2.5 rounded-xl text-sm transition shadow-sm ${isDark ? 'bg-amber-700 hover:bg-amber-800 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
                  {t.addCalendar}
                </button>
              </div>
            </div>
          )}
          <Timeline events={events} />
        </section>
      </div>
    );
  }

  // ── 學生總覽頁 ──
  if (currentView === 'students') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors ${
            isDark ? 'bg-slate-800 text-sky-400 hover:bg-slate-700' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
          }`}
        >
          <ArrowLeft size={16} className="mr-1.5" />
          {t.goBack}
        </button>

        <StudentList />
      </div>
    );
  }

  // ── 系統最高管理中心 (Role 0 專屬整合面板) ──
  if (currentView === 'superadmin') {
    return (
      <div className="space-y-6 pb-8">
        <button 
          onClick={() => setCurrentView('menu')}
          className={`flex items-center font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors ${
            isDark ? 'bg-slate-800 text-purple-400 hover:bg-slate-700' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          <ArrowLeft size={16} className="mr-1.5" />
          {t.goBack}
        </button>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${textColor}`}>系統最高管理中心</h2>
            <p className={`text-sm mt-0.5 ${subTextColor}`}>Role 0 超級管理員專屬後台 · 白名單編修、資料庫更新與冷備份</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            最高權限控制台
          </span>
        </div>

        {/* 次分頁標籤導航 */}
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setSuperadminTab('whitelist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              superadminTab === 'whitelist'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <ShieldCheck size={15} />
            教職員白名單與權限編修
          </button>
          <button
            onClick={() => setSuperadminTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              superadminTab === 'import'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <Database size={15} />
            資料庫 Excel 批次匯入
          </button>
          <button
            onClick={() => setSuperadminTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              superadminTab === 'backup'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 hover:text-stone-900'
            }`}
          >
            <HardDrive size={15} />
            全校資料庫一鍵冷備份
          </button>
        </div>

        {/* 分頁內容 1：白名單與權限線上編修 */}
        {superadminTab === 'whitelist' && (
          <StaffList />
        )}

        {/* 分頁內容 2：資料庫批次匯入 */}
        {superadminTab === 'import' && (
          <div className="space-y-6">
            {uploadStatus && (
              <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
                uploadStatus.includes('成功')
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800' 
                  : uploadStatus.includes('失敗') || uploadStatus.includes('錯誤')
                    ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800' 
                    : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800'
              }`}>
                {uploadStatus.includes('失敗') || uploadStatus.includes('錯誤') ? (
                  <AlertCircle size={18} className="flex-shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <span>{uploadStatus}</span>
              </div>
            )}

            {/* 學生資料上傳區塊 */}
            <section className={`rounded-2xl shadow-sm p-5 border-l-4 border-l-sky-500 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap size={20} className="text-sky-600 dark:text-sky-400" />
                <h3 className={`text-lg font-extrabold ${textColor}`}>匯入學生總表</h3>
              </div>
              <p className={`text-xs mb-4 ${subTextColor}`}>包含學號、年級、班級、醫療、家長等 31 個完整欄位</p>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-stone-300 bg-stone-50'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <UploadCloud size={32} className={`mx-auto mb-2 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                <label className={`cursor-pointer inline-flex items-center gap-2 rounded-lg text-white text-sm font-bold px-4 py-2 transition shadow-sm ${isLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 active:scale-95'}`}>
                  <UploadCloud size={16} />
                  {isLoading ? '處理中...' : '選擇 Excel / CSV 檔案'}
                  <input type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleStudentUpload} disabled={isLoading} />
                </label>
              </div>
            </section>

            {/* 教職員資料上傳區塊 */}
            <section className={`rounded-2xl shadow-sm p-5 border-l-4 border-l-emerald-500 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Users size={20} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className={`text-lg font-extrabold ${textColor}`}>匯入教職員名冊</h3>
              </div>
              <p className={`text-xs mb-4 ${subTextColor}`}>用於開通權限，包含姓名、職稱、任教班級、信箱</p>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-stone-300 bg-stone-50'}`}>
                <UploadCloud size={32} className={`mx-auto mb-2 ${isDark ? 'text-stone-400' : 'text-stone-500'}`} />
                <label className={`cursor-pointer inline-flex items-center gap-2 rounded-lg text-white text-sm font-bold px-4 py-2 transition shadow-sm ${isLoading ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'}`}>
                  <UploadCloud size={16} />
                  {isLoading ? '處理中...' : '選擇 Excel / CSV 檔案'}
                  <input type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleStaffUpload} disabled={isLoading} />
                </label>
              </div>
            </section>

            {/* 行事曆設定區塊 */}
            <section className={`rounded-2xl shadow-sm p-5 border-l-4 border-l-amber-500 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={20} className="text-amber-600 dark:text-amber-400" />
                <h3 className={`text-lg font-extrabold ${textColor}`}>介接 Google 日曆</h3>
              </div>
              <p className={`text-xs mb-4 ${subTextColor}`}>設定全校行事曆來源</p>
              <div className="space-y-3">
                <input type="text" placeholder="請輸入 Google Calendar ID" className={`w-full text-sm p-3 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500 ${isDark ? 'bg-slate-800 border-slate-700 text-stone-100 placeholder-stone-400' : 'bg-stone-50 border-stone-300 text-stone-900'}`} />
                <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm">
                  儲存日曆設定
                </button>
              </div>
            </section>
          </div>
        )}

        {/* 分頁內容 3：全校資料庫冷備份 */}
        {superadminTab === 'backup' && (
          <div className={`p-6 rounded-2xl border shadow-sm ${cardBg} border-stone-200 dark:border-slate-800`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <HardDrive size={22} />
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${textColor}`}>全校校務資料庫一鍵冷備份</h3>
                <p className={`text-xs mt-0.5 ${subTextColor}`}>將學生總冊、教職員名冊與校務資料打包導出為 JSON 實體檔案</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border mb-5 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-stone-50 border-stone-200'}`}>
              <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                點擊下方按鈕後，系統將直接從雲端資料庫提取全校學生名冊與教職員白名單之即時完整結構，並在您的電腦本機生成帶有時間戳記的獨立備份檔。即使網路中斷或雲端服務商發生異常，學校仍保有 100% 原始數據資產。
              </p>
            </div>

            {backupStatus && (
              <div className="mb-4 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{backupStatus}</span>
              </div>
            )}

            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm active:scale-[0.98]"
            >
              <Download size={15} />
              <span>立即下載全校資料庫備份檔案</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 主選單頁 (Menu) ──
  return (
    <div className="space-y-6 pb-8">
      {/* 頂部標題 */}
      <div>
        <h2 className={`text-2xl font-black tracking-tight ${textColor}`}>{t.adminTitle}</h2>
        <p className={`text-sm mt-0.5 ${subTextColor}`}>{t.adminDesc}</p>
      </div>

      {/* 區塊 1：公告專區 (綠色系) */}
      <section className={`rounded-2xl p-4 sm:p-5 border transition-all shadow-sm ${
        isDark 
          ? 'bg-emerald-950/20 border-emerald-800/40' 
          : 'bg-emerald-50/70 border-emerald-200/80'
      }`}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <Megaphone size={16} />
          </div>
          <div>
            <h3 className={`text-base font-extrabold ${isDark ? 'text-emerald-200' : 'text-emerald-900'}`}>全校公告專區</h3>
            <p className={`text-xs ${isDark ? 'text-emerald-400/90' : 'text-emerald-700/80'}`}>即時校園通告與重要事項討論</p>
          </div>
        </div>
        <BulletinBoard />
      </section>

      {/* 區塊 2、3、4：行事曆 (黃色系)、學生總覽 (藍色系)、全校總課表 (青綠系) */}
      <div className="grid grid-cols-1 gap-4">
        {/* 行事曆按鈕區塊 */}
        <button 
          onClick={() => setCurrentView('calendar')}
          className={`p-5 rounded-2xl shadow-sm flex items-center justify-between transition-all active:scale-[0.99] border text-left ${
            isDark 
              ? 'bg-amber-950/25 hover:bg-amber-900/35 border-amber-800/40 text-stone-100' 
              : 'bg-amber-50/90 hover:bg-amber-100/80 border-amber-200/80 text-stone-900'
          }`}
        >
          <div className="flex items-start gap-3.5 pr-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
              <Calendar size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-lg font-extrabold ${isDark ? 'text-amber-200' : 'text-amber-950'}`}>{t.calendarTitle}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                  開發樣本 - 尚未串接 Google 日曆
                </span>
              </div>
              <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-800/80'}`}>
                {t.calendarDesc}，點擊即可瀏覽學校活動與行事排程
              </p>
            </div>
          </div>
          <ChevronRight size={22} className={`flex-shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
        </button>

        {/* 學生名冊與資料總覽按鈕區塊 */}
        <button 
          onClick={() => setCurrentView('students')}
          className={`p-5 rounded-2xl shadow-sm flex items-center justify-between transition-all active:scale-[0.99] border text-left ${
            isDark 
              ? 'bg-sky-950/25 hover:bg-sky-900/35 border-sky-800/40 text-stone-100' 
              : 'bg-sky-50/90 hover:bg-sky-100/80 border-sky-200/80 text-stone-900'
          }`}
        >
          <div className="flex items-start gap-3.5 pr-2">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
              <GraduationCap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-lg font-extrabold ${isDark ? 'text-sky-200' : 'text-sky-950'}`}>{t.rosterTitle}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-200/80 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200 border border-sky-300 dark:border-sky-700/60">
                  全校學籍資料
                </span>
              </div>
              <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-sky-300/80' : 'text-sky-800/80'}`}>
                {t.rosterDesc}，支援跨班多選、自學篩選、醫療及身分資料
              </p>
            </div>
          </div>
          <ChevronRight size={22} className={`flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
        </button>

        {/* 全校教師授課總課表 (青綠系按鈕區塊) */}
        <button 
          onClick={() => setCurrentView('timetable')}
          className={`p-5 rounded-2xl shadow-sm flex items-center justify-between transition-all active:scale-[0.99] border text-left ${
            isDark 
              ? 'bg-teal-950/25 hover:bg-teal-900/35 border-teal-800/40 text-stone-100' 
              : 'bg-teal-50/90 hover:bg-teal-100/80 border-teal-200/80 text-stone-900'
          }`}
        >
          <div className="flex items-start gap-3.5 pr-2">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-lg font-extrabold ${isDark ? 'text-teal-200' : 'text-teal-950'}`}>全校教師授課總課表</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-200/80 text-teal-900 dark:bg-teal-900/60 dark:text-teal-200 border border-teal-300 dark:border-teal-700/60">
                  霧臺校區 · 勵古百合分校
                </span>
              </div>
              <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-teal-300/80' : 'text-teal-800/80'}`}>
                雙校區教師授課全覽，點擊進入免下載全螢幕手勢縮放檢視器
              </p>
            </div>
          </div>
          <ChevronRight size={22} className={`flex-shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
        </button>

        {/* 區塊 5：AI 校務大腦知識庫 (專屬開放給 0, 1, 2, 3 權限同仁) */}
        {canAccessBrain && (
          <SchoolBrain />
        )}

        {/* 區塊 6：超級管理員專屬整併入口 (單一高級紫色卡片) */}
        {isSuperAdmin && (
          <button 
            onClick={() => setCurrentView('superadmin')}
            className={`p-5 rounded-2xl shadow-sm flex items-center justify-between transition-all active:scale-[0.99] border text-left ${
              isDark 
                ? 'bg-purple-950/25 hover:bg-purple-900/35 border-purple-800/40 text-stone-100' 
                : 'bg-purple-50/90 hover:bg-purple-100/80 border-purple-200/80 text-stone-900'
            }`}
          >
            <div className="flex items-start gap-3.5 pr-2">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg font-extrabold ${isDark ? 'text-purple-200' : 'text-purple-950'}`}>系統最高管理中心</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-200/80 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-300 dark:border-purple-700/60">
                    Role 0 專屬
                  </span>
                </div>
                <p className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-purple-300/80' : 'text-purple-800/80'}`}>
                  教職員白名單線上編修、角色權限指派、資料庫批次匯入與全校一鍵冷備份
                </p>
              </div>
            </div>
            <ChevronRight size={22} className={`flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
          </button>
        )}
      </div>
    </div>
  );
}
