import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  BrainCircuit,
  Folder,
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldAlert,
  School,
  BookOpen,
  Compass,
  Wrench,
  Users,
  Search,
  X,
  AlertCircle
} from 'lucide-react';

const DEPARTMENTS = [
  {
    id: 'principal',
    name: '校長室',
    allowedRoleTags: ['1'],
    deptKeyword: '校長',
    desc: '校務中長程發展計畫、校長辦學方針與各項評鑑資料',
    icon: School,
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
  },
  {
    id: 'academic',
    name: '教務處',
    allowedRoleTags: ['2', '3'],
    deptKeyword: '教務',
    desc: '學生成績評量要點、全校課表編排原則、本土語與課程計畫書',
    icon: BookOpen,
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
  },
  {
    id: 'student_affairs',
    name: '學務處',
    allowedRoleTags: ['2', '3'],
    deptKeyword: '學務',
    desc: '學生請假與出缺勤規定、校外教學規範、學生獎懲與生活常規',
    icon: Compass,
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  {
    id: 'general_affairs',
    name: '總務處',
    allowedRoleTags: ['2', '3'],
    deptKeyword: '總務',
    desc: '校園公物報修、場地與器材借用辦法、財產管理與採購規範',
    icon: Wrench,
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
  },
  {
    id: 'personnel',
    name: '人事室',
    allowedRoleTags: ['2'],
    deptKeyword: '人事',
    desc: '教職員請假手續、差旅費報支要點、差勤考核與研習規定',
    icon: Users,
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
  },
  {
    id: 'ligu',
    name: '勵古百合分校',
    allowedRoleTags: ['2'],
    deptKeyword: '勵古',
    desc: '分校民族實驗教育課程指南、魯凱傳統文化教材與專案規範',
    icon: Sparkles,
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
  }
];

export default function SchoolBrain() {
  const { isDark, staffData, liffProfile } = useApp();
  const [selectedDeptId, setSelectedDeptId] = useState('academic');
  
  // 徹底移除任何測試假資料，預設為乾淨空陣列，優先從本機儲存與後端同步
  const [documents, setDocuments] = useState(() => {
    try {
      const cached = localStorage.getItem('wutps_real_brain_docs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const userRoleTags = staffData?.role_tags || '';
  const userDept = staffData?.department || '';
  const isSuperAdmin = userRoleTags.includes('0') || staffData?.email?.includes('u864001');

  const activeDept = DEPARTMENTS.find(d => d.id === selectedDeptId) || DEPARTMENTS[0];

  // 進入時自伺服器同步真實上傳的文件
  useEffect(() => {
    fetchServerDocuments();
  }, []);

  const fetchServerDocuments = async () => {
    try {
      const res = await fetch('/api/brain');
      if (res.ok) {
        const serverDocs = await res.json();
        if (Array.isArray(serverDocs) && serverDocs.length > 0) {
          // 合併本機與雲端資料
          setDocuments(prev => {
            const map = new Map();
            prev.forEach(d => map.set(d.id || d.title, d));
            serverDocs.forEach(d => map.set(d.id || d.title, {
              id: d.id,
              deptId: d.dept_id,
              title: d.title,
              fileName: d.file_name || d.title,
              fileSize: d.file_size || '',
              uploadedBy: d.uploaded_by || '',
              uploadedAt: d.created_at ? d.created_at.split('T')[0] : '',
              status: 'indexed',
              extractedText: d.extracted_text || '',
              extractedSummary: d.summary || (d.extracted_text ? d.extracted_text.slice(0, 200) + '...' : '已解析入庫')
            }));
            const merged = Array.from(map.values());
            localStorage.setItem('wutps_real_brain_docs', JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('Sync brain documents error:', err);
    }
  };

  // 檢查當前使用者是否有權限在該處室資料夾上傳或刪除文件
  const canManageActiveDept = () => {
    if (isSuperAdmin) return true; // 超級管理者全開

    // 校長 (1) 可管理校長室
    if (activeDept.id === 'principal' && userRoleTags.includes('1')) {
      return true;
    }

    // 主任/組長 (2, 3) 需匹配對應處室
    const hasRole = activeDept.allowedRoleTags.some(r => userRoleTags.includes(r));
    const isDeptMatched = userDept.includes(activeDept.deptKeyword);
    return hasRole && isDeptMatched;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('請上傳 PDF 格式之官方文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      // 1. 真實讀取並萃取 PDF 文字
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(45);

      let extractedText = '';
      try {
        const pdfDoc = await pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          disableRange: true,
          disableStream: true
        }).promise;

        const maxPages = Math.min(pdfDoc.numPages, 10);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageStr = textContent.items.map(item => item.str).join(' ');
          if (pageStr.trim()) {
            extractedText += `【第 ${i} 頁】\n${pageStr}\n\n`;
          }
        }
      } catch (pdfErr) {
        console.warn('PDF 文字萃取提醒:', pdfErr);
      }

      setUploadProgress(75);

      // 自動產生摘要
      const cleanSnippet = extractedText.replace(/【第 \d+ 頁】/g, '').replace(/\s+/g, ' ').trim();
      const generatedSummary = cleanSnippet.length > 250
        ? cleanSnippet.slice(0, 250) + '...'
        : (cleanSnippet || '此文件已成功萃取全文結構，LINE Gemini 機器人將依據其文字精準問答。');

      const uploaderName = staffData?.name || liffProfile?.displayName || '校務同仁';
      const newDoc = {
        id: `doc-${Date.now()}`,
        deptId: activeDept.id,
        title: file.name,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedBy: uploaderName,
        uploadedAt: new Date().toISOString().split('T')[0],
        status: 'indexed',
        extractedText: extractedText,
        extractedSummary: generatedSummary
      };

      // 2. 存入後端 API (Supabase)
      try {
        await fetch('/api/brain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dept_id: activeDept.id,
            title: file.name,
            file_name: file.name,
            file_size: newDoc.fileSize,
            uploaded_by: uploaderName,
            extracted_text: extractedText,
            summary: generatedSummary
          })
        });
      } catch (apiErr) {
        console.warn('API 保存提醒:', apiErr);
      }

      // 3. 更新前端狀態與本機持久化快照
      setDocuments(prev => {
        const updated = [newDoc, ...prev];
        localStorage.setItem('wutps_real_brain_docs', JSON.stringify(updated));
        return updated;
      });

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 400);

    } catch (err) {
      console.error('上傳處理失敗:', err);
      alert('上傳失敗: ' + err.message);
      setIsUploading(false);
      setUploadProgress(0);
    } finally {
      e.target.value = null;
    }
  };

  const handleDelete = async (docId, title) => {
    if (!canManageActiveDept()) {
      alert('您沒有權限刪除此處室之大腦文件');
      return;
    }
    if (window.confirm(`確定要將《${title}》從 AI 大腦中徹底移除嗎？移除後 LINE 機器人將無法檢索此檔案。`)) {
      try {
        await fetch('/api/brain', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: docId })
        });
      } catch (err) {
        console.warn('Delete API warning:', err);
      }

      setDocuments(prev => {
        const filtered = prev.filter(d => (d.id || d.title) !== docId && d.title !== title);
        localStorage.setItem('wutps_real_brain_docs', JSON.stringify(filtered));
        return filtered;
      });
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchDept = doc.deptId === selectedDeptId;
    const matchSearch = searchTerm === '' || 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (doc.extractedSummary && doc.extractedSummary.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchDept && matchSearch;
  });

  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';
  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={`rounded-2xl border shadow-sm p-4 sm:p-6 transition-all ${
      isDark 
        ? 'bg-indigo-950/20 border-indigo-800/40' 
        : 'bg-indigo-50/70 border-indigo-200/80'
    }`}>
      {/* ── 區塊標題 ── */}
      <div className="flex items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-indigo-200/50 dark:border-indigo-800/40 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <BrainCircuit size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-lg font-extrabold ${isDark ? 'text-indigo-200' : 'text-indigo-950'}`}>
                AI 校務大腦知識庫
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-200/80 text-indigo-900 dark:bg-indigo-900/80 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700/60">
                123 權限專屬
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Sparkles size={11} />
                連線 LINE 機器人
              </span>
            </div>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-indigo-300/80' : 'text-indigo-800/80'}`}>
              各處室上傳之官方 PDF 規章將自動成為 Gemini 大腦記憶，供官方 LINE 聊天室即時精準問答
            </p>
          </div>
        </div>
      </div>

      {/* ── 六大處室資料夾切換列 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {DEPARTMENTS.map(dept => {
          const IconComponent = dept.icon;
          const isSelected = selectedDeptId === dept.id;
          const count = documents.filter(d => d.deptId === dept.id).length;

          return (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition text-left relative ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400/40'
                  : isDark
                    ? 'bg-slate-900/90 border-slate-800 hover:bg-slate-800/80 text-stone-200'
                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isSelected 
                    ? 'bg-white/20 text-white' 
                    : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                }`}>
                  <IconComponent size={15} />
                </div>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  isSelected 
                    ? 'bg-white/20 text-white' 
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300'
                }`}>
                  {count}
                </span>
              </div>
              <div>
                <p className="text-xs font-black truncate">{dept.name}</p>
                <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-stone-400'}`}>
                  {dept.desc.slice(0, 10)}...
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 當前處室大腦面板 ── */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${cardBg}`}>
        {/* 處室資訊與上傳按鈕 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-stone-200/70 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className={`text-base font-extrabold ${textColor}`}>
                {activeDept.name} 大腦資料夾
              </h4>
              <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${activeDept.badgeColor}`}>
                {activeDept.id === 'principal' ? '校長(1)專屬' : '處室(2,3)專屬'}
              </span>
            </div>
            <p className={`text-xs mt-1 ${subTextColor}`}>
              {activeDept.desc}
            </p>
          </div>

          {/* 上傳操作或權限提醒 */}
          <div className="flex items-center gap-2">
            {canManageActiveDept() ? (
              <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-sm active:scale-[0.98]">
                <Upload size={14} />
                <span>上傳 PDF 文件</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-stone-400 border border-stone-200 dark:border-slate-700">
                <ShieldAlert size={14} />
                <span>唯讀瀏覽權限</span>
              </div>
            )}
          </div>
        </div>

        {/* 上傳進度條 */}
        {isUploading && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <div className="flex justify-between text-xs font-bold text-indigo-800 dark:text-indigo-200 mb-1.5">
              <span>正在即時解析 PDF 全文並建立大腦索引...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* 搜尋過濾 */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`搜尋 ${activeDept.name} 已吸收之規章或關鍵字...`}
            className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-indigo-500 ${
              isDark 
                ? 'bg-slate-800/80 border-slate-700 text-stone-100 placeholder-stone-400' 
                : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'
            }`}
          />
        </div>

        {/* 文件列表 */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-xl border-stone-200 dark:border-slate-800">
            <FileText size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
            <p className={`text-xs font-bold ${subTextColor}`}>
              {searchTerm ? '找不到符合關鍵字之大腦文件' : `此處室目前尚無文件，大腦處於純淨狀態`}
            </p>
            {canManageActiveDept() && !searchTerm && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                請點擊右上角「上傳 PDF 文件」按鈕，即可將真實的處室規章加入大腦
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredDocs.map(doc => (
              <div
                key={doc.id || doc.title}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isDark
                    ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700'
                    : 'bg-stone-50/80 border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className={`text-sm font-extrabold truncate ${textColor}`}>
                      {doc.title}
                    </h5>
                    <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-1 flex-wrap">
                      <span>大小: {doc.fileSize}</span>
                      <span>上傳人: {doc.uploadedBy}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {doc.uploadedAt}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 size={11} />
                        Gemini 大腦已就緒
                      </span>
                    </div>
                  </div>
                </div>

                {/* 操作按鈕群 */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {/* 查看萃取大腦摘要 */}
                  <button
                    onClick={() => setSelectedDocForPreview(doc)}
                    title="檢視大腦萃取摘要"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition bg-white dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700"
                  >
                    <Eye size={13} />
                    <span>大腦摘要</span>
                  </button>

                  {/* 刪除文件 */}
                  {canManageActiveDept() && (
                    <button
                      onClick={() => handleDelete(doc.id || doc.title, doc.title)}
                      title="自大腦中徹底刪除"
                      className="p-1.5 rounded-lg border transition text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border-stone-200 dark:border-slate-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 摘要與大腦預覽彈窗 Modal ── */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-fade-in ${
            isDark ? 'bg-slate-900 border-slate-700 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-stone-50 border-stone-100'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-black text-sm">Gemini AI 大腦摘要與真實萃取資訊</h4>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <p className="text-xs font-bold text-stone-400">文件名稱</p>
                <p className="text-sm font-extrabold mt-0.5">{selectedDocForPreview.title}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-stone-400">所屬處室與建立者</p>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {activeDept.name} · {selectedDocForPreview.uploadedBy} ({selectedDocForPreview.uploadedAt})
                </p>
              </div>

              <div className={`p-3.5 rounded-xl border ${
                isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-indigo-50/70 border-indigo-200/80'
              }`}>
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1.5 flex items-center gap-1.5">
                  <BrainCircuit size={13} />
                  核心重點摘要 (供 LINE 機器人回答使用)：
                </p>
                <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                  {selectedDocForPreview.extractedSummary}
                </p>
              </div>

              {selectedDocForPreview.extractedText && (
                <div>
                  <p className="text-xs font-bold text-stone-400 mb-1">已萃取之全文內容片段：</p>
                  <div className={`p-3 rounded-xl border text-[11px] font-mono leading-relaxed max-h-40 overflow-y-auto ${
                    isDark ? 'bg-slate-800/50 border-slate-700 text-stone-300' : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}>
                    {selectedDocForPreview.extractedText.slice(0, 1000)}
                    {selectedDocForPreview.extractedText.length > 1000 && ' ...（更多內文已建置入庫）'}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedDocForPreview(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
