import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
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
  ChevronRight,
  AlertCircle,
  X,
  Download
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

// 預設的大腦典藏資料範本
const INITIAL_DOCUMENTS = [
  {
    id: 'doc-1',
    deptId: 'academic',
    title: '屏東縣霧臺國小學生評量要點與升級規範.pdf',
    fileName: '屏東縣霧臺國小學生評量要點與升級規範.pdf',
    fileSize: '1.2 MB',
    uploadedBy: '教務處 · 註冊組',
    uploadedAt: '2026-08-28',
    status: 'indexed',
    extractedSummary: '規定平時評量佔50%、定期評量佔50%。自學生缺席節數達全學期授課總節數三分之一以上者，不予核發畢業證書，僅核給修業證明書。'
  },
  {
    id: 'doc-2',
    deptId: 'student_affairs',
    title: '霧臺國小學生出缺勤請假與銷假作業規程.pdf',
    fileName: '霧臺國小學生出缺勤請假與銷假作業規程.pdf',
    fileSize: '840 KB',
    uploadedBy: '學務處 · 生教組',
    uploadedAt: '2026-08-30',
    status: 'indexed',
    extractedSummary: '事假需於兩日前提出；病假可於當日由家長以 LINE 或電話知會導師，並於到校後三日內補辦手續。連續請假三日以上須檢附醫師就醫證明。'
  },
  {
    id: 'doc-3',
    deptId: 'general_affairs',
    title: '校園場地設施借用辦法暨收費標準表.pdf',
    fileName: '校園場地設施借用辦法暨收費標準表.pdf',
    fileSize: '1.8 MB',
    uploadedBy: '總務主任',
    uploadedAt: '2026-08-15',
    status: 'indexed',
    extractedSummary: '校外機構借用風雨球場或視聽教室需於活動前十四天備妥公文提出申請；本鄉部落居民或公益活動經專案核准得免收場地清潔費。'
  },
  {
    id: 'doc-4',
    deptId: 'principal',
    title: '霧臺國小校務中長程發展計畫書 (114-117學年度).pdf',
    fileName: '霧臺國小校務中長程發展計畫書.pdf',
    fileSize: '3.4 MB',
    uploadedBy: '校長室',
    uploadedAt: '2026-08-10',
    status: 'indexed',
    extractedSummary: '四大核心主軸：深耕魯凱文化底蘊、精進數位科技學習、厚植雙語國際視野、構築安全友善校園。'
  },
  {
    id: 'doc-5',
    deptId: 'ligu',
    title: '勵古百合分校民族文化歲時祭儀專案推動手冊.pdf',
    fileName: '勵古百合分校民族文化歲時祭儀專案推動手冊.pdf',
    fileSize: '2.1 MB',
    uploadedBy: '分校主任',
    uploadedAt: '2026-08-20',
    status: 'indexed',
    extractedSummary: '詳細規範小米收穫祭、搭鞦韆祭典、傳統織布與石板屋建築工藝課程之授課時數與耆老協同教學聘用準則。'
  },
  {
    id: 'doc-6',
    deptId: 'personnel',
    title: '教職員差勤手續與加班研習時數報支規範.pdf',
    fileName: '教職員差勤手續與加班研習時數報支規範.pdf',
    fileSize: '950 KB',
    uploadedBy: '人事室',
    uploadedAt: '2026-08-25',
    status: 'indexed',
    extractedSummary: '同仁公出公差應於事前完成線上簽核；研習進修奉准者核予公假，假日支援校內重大活動得於二年內補休完畢。'
  }
];

export default function SchoolBrain() {
  const { isDark, staffData, liffProfile } = useApp();
  const [selectedDeptId, setSelectedDeptId] = useState('academic');
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const userRoleTags = staffData?.role_tags || '';
  const userDept = staffData?.department || '';
  const isSuperAdmin = userRoleTags.includes('0') || staffData?.email?.includes('u864001');

  const activeDept = DEPARTMENTS.find(d => d.id === selectedDeptId) || DEPARTMENTS[0];

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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      alert('請上傳 PDF 格式之官方文件');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    // 模擬後端文字提取與 Gemini 大腦索引過程
    const timer1 = setTimeout(() => setUploadProgress(60), 400);
    const timer2 = setTimeout(() => {
      setUploadProgress(100);
      const newDoc = {
        id: `doc-${Date.now()}`,
        deptId: activeDept.id,
        title: file.name,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedBy: staffData?.name || liffProfile?.displayName || '行政同仁',
        uploadedAt: new Date().toISOString().split('T')[0],
        status: 'indexed',
        extractedSummary: `此文件已由系統自動解析全文並建立向量索引，官方 LINE 機器人已可根據此份《${file.name}》精準回答提問。`
      };

      setDocuments(prev => [newDoc, ...prev]);
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = null;
    }, 1000);
  };

  const handleDelete = (docId, title) => {
    if (!canManageActiveDept()) {
      alert('您沒有權限刪除此處室之大腦文件');
      return;
    }
    if (window.confirm(`確定要將《${title}》從 AI 大腦中移除嗎？移除後 LINE 機器人將無法檢索此檔案。`)) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchDept = doc.deptId === selectedDeptId;
    const matchSearch = searchTerm === '' || 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      doc.extractedSummary.toLowerCase().includes(searchTerm.toLowerCase());
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
              <span>文件文字解析與大腦向量索引中...</span>
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
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-2" />
            <p className={`text-xs font-bold ${subTextColor}`}>
              {searchTerm ? '找不到符合關鍵字之大腦文件' : '此資料夾目前尚無已吸收之官方 PDF'}
            </p>
            {canManageActiveDept() && !searchTerm && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                點擊上方「上傳 PDF 文件」按鈕即可為校務大腦擴充記憶
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredDocs.map(doc => (
              <div
                key={doc.id}
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
                      onClick={() => handleDelete(doc.id, doc.title)}
                      title="自大腦中移除"
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
                <h4 className="font-black text-sm">Gemini AI 大腦摘要與萃取資訊</h4>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
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
                  核心重點與規則摘要 (用於回答 LINE 提問)：
                </p>
                <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                  {selectedDocForPreview.extractedSummary}
                </p>
              </div>

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
