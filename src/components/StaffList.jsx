import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { getAuthHeaders } from '../lib/authHeader';
import { Check, X, ShieldCheck, UserPlus, Edit3, Trash2, Unlink, Search, Save, Settings, Plus, Tag, Building2 } from 'lucide-react';

export const WUTPS_CLASSES = [
  '一甲', '二甲', '三甲', '四甲', '五甲', '六甲',
  '一乙', '二乙', '三乙', '四乙', '五乙', '六乙'
];

export const DEFAULT_DEPARTMENTS = [
  '校長室',
  '教導處',
  '學務處',
  '總務處',
  '研發處',
  '幼兒園',
  '勵古百合分校',
  '專案/兼任'
];

export const DEFAULT_ROLE_TAGS = [
  // 0 管理者
  { tag: '0', label: '0 管理者', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300', group: 'admin', groupTitle: '系統最高管理' },
  // 1~10 職務角色與專任教學
  { tag: '1', label: '1 校長', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '2', label: '2 主任', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '3', label: '3 組長', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '4', label: '4 導師', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '5', label: '5 科任', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '6', label: '6 族語', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '7', label: '7 英語', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '8', label: '8 職員', color: 'bg-stone-200 text-stone-800 dark:bg-slate-700 dark:text-stone-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '9', label: '9 特教', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300', group: 'role', groupTitle: '職務與教學角色' },
  { tag: '10', label: '10 輔導', color: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300', group: 'role', groupTitle: '職務與教學角色' },
  // 20~60 處室所屬單位
  { tag: '20', label: '20 教導處', color: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300', group: 'dept', groupTitle: '所屬處室單位' },
  { tag: '30', label: '30 學務處', color: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300', group: 'dept', groupTitle: '所屬處室單位' },
  { tag: '40', label: '40 總務處', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300', group: 'dept', groupTitle: '所屬處室單位' },
  { tag: '50', label: '50 研發處', color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300', group: 'dept', groupTitle: '所屬處室單位' },
  { tag: '60', label: '60 幼兒園', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300', group: 'dept', groupTitle: '所屬處室單位' }
];

export default function StaffList() {
  const { isDark } = useApp();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState('');

  // 處室管理 state (持久化於 localStorage)
  const [customDepartments, setCustomDepartments] = useState(() => {
    try {
      const saved = localStorage.getItem('wutps_custom_departments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 動態整合所有處室（預設 + 自訂 + 既有同仁處室）
  const allDepartments = useMemo(() => {
    const fromStaff = staff.map(s => s.department?.trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_DEPARTMENTS, ...customDepartments, ...fromStaff]));
  }, [staff, customDepartments]);

  const handleAddCustomDepartment = (deptName) => {
    const trimmed = deptName?.trim();
    if (!trimmed) return;
    if (allDepartments.includes(trimmed)) return;
    const next = [...customDepartments, trimmed];
    setCustomDepartments(next);
    try {
      localStorage.setItem('wutps_custom_departments', JSON.stringify(next));
    } catch {}
  };

  const handleDeleteCustomDepartment = (deptName) => {
    const next = customDepartments.filter(d => d !== deptName);
    setCustomDepartments(next);
    try {
      localStorage.setItem('wutps_custom_departments', JSON.stringify(next));
    } catch {}
  };

  // 角色權限標籤管理 state (持久化於 localStorage)
  const [customRoleTags, setCustomRoleTags] = useState(() => {
    try {
      const saved = localStorage.getItem('wutps_custom_role_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 動態整合所有可用角色標籤（預設 + 自訂 + 既有同仁標籤）
  const allRoleTags = useMemo(() => {
    const tagMap = new Map();
    DEFAULT_ROLE_TAGS.forEach(rt => tagMap.set(rt.tag, rt));
    customRoleTags.forEach(ct => tagMap.set(ct.tag, ct));

    // 掃描資料庫中同仁身上是否有未定義之標籤碼
    staff.forEach(s => {
      if (s.role_tags) {
        s.role_tags.split(/[,，、\s]+/).forEach(rawTag => {
          const t = rawTag.trim();
          if (t && !tagMap.has(t)) {
            tagMap.set(t, {
              tag: t,
              label: `${t} (既有標籤)`,
              color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
            });
          }
        });
      }
    });

    return Array.from(tagMap.values()).sort((a, b) => {
      const numA = parseInt(a.tag, 10);
      const numB = parseInt(b.tag, 10);
      return isNaN(numA) || isNaN(numB) ? a.tag.localeCompare(b.tag) : numA - numB;
    });
  }, [staff, customRoleTags]);

  const handleAddCustomRoleTag = (tagStr, labelStr) => {
    const tag = tagStr?.trim();
    if (!tag) return;
    const label = (labelStr || tag).trim();
    if (allRoleTags.some(r => r.tag === tag)) return;

    const newTagObj = {
      tag,
      label: label.startsWith(tag) ? label : `${tag} ${label}`,
      color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
      isCustom: true
    };
    const next = [...customRoleTags, newTagObj];
    setCustomRoleTags(next);
    try {
      localStorage.setItem('wutps_custom_role_tags', JSON.stringify(next));
    } catch {}
  };

  const handleDeleteCustomRoleTag = (tag) => {
    const next = customRoleTags.filter(t => t.tag !== tag);
    setCustomRoleTags(next);
    try {
      localStorage.setItem('wutps_custom_role_tags', JSON.stringify(next));
    } catch {}
  };

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null); // null means adding new
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '教務處',
    title: '',
    class_assigned: '',
    role_tags: '4'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Modal 內部動態新增處室與標籤狀態
  const [isCustomDeptInput, setIsCustomDeptInput] = useState(false);
  const [customDeptInputText, setCustomDeptInputText] = useState('');
  const [customTagInputText, setCustomTagInputText] = useState('');

  // 專屬「處室與標籤清單管理視窗」狀態
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configTab, setConfigTab] = useState('departments'); // 'departments' | 'tags'
  const [newDeptInput, setNewDeptInput] = useState('');
  const [newTagCodeInput, setNewTagCodeInput] = useState('');
  const [newTagLabelInput, setNewTagLabelInput] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      let uid = '';
      if (window.liff?.isLoggedIn()) {
        const profile = await window.liff.getProfile();
        uid = profile?.userId || '';
      }
      setCurrentUid(uid);

      if (!uid) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/staff', {
        headers: getAuthHeaders(uid)
      });
      const data = await response.json();
      
      if (response.ok) {
        setStaff(Array.isArray(data) ? data : []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setIsCustomDeptInput(false);
    setCustomDeptInputText('');
    setCustomTagInputText('');
    setFormData({
      name: '',
      email: '',
      department: allDepartments[0] || '教務處',
      title: '',
      class_assigned: '',
      role_tags: '4'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingStaff(member);
    setIsCustomDeptInput(false);
    setCustomDeptInputText('');
    setCustomTagInputText('');
    setFormData({
      name: member.name || '',
      email: member.email || '',
      department: member.department || allDepartments[0] || '教務處',
      title: member.title || '',
      class_assigned: member.class_assigned || '',
      role_tags: member.role_tags || ''
    });
    setIsModalOpen(true);
  };

  const handleClassChange = (selectedClass) => {
    let updatedTags = formData.role_tags;
    if (selectedClass) {
      const tagsArr = updatedTags ? updatedTags.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (!tagsArr.includes('4')) {
        tagsArr.push('4');
        tagsArr.sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          return isNaN(numA) || isNaN(numB) ? a.localeCompare(b) : numA - numB;
        });
        updatedTags = tagsArr.join(',');
      }
    }
    setFormData({ ...formData, class_assigned: selectedClass, role_tags: updatedTags });
  };

  const handleAddTagFromInline = () => {
    const raw = customTagInputText.trim();
    if (!raw) return;
    const match = raw.match(/^([a-zA-Z0-9_-]+)\s*(.*)$/);
    const code = match ? match[1] : raw;
    const label = (match && match[2]) ? match[2] : raw;
    handleAddCustomRoleTag(code, label);
    const currentTags = formData.role_tags
      ? formData.role_tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    if (!currentTags.includes(code)) {
      setFormData({
        ...formData,
        role_tags: [...currentTags, code].join(',')
      });
    }
    setCustomTagInputText('');
  };

  const handleToggleRoleTag = (tag) => {
    const currentTags = formData.role_tags
      ? formData.role_tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    
    let newTags;
    if (currentTags.includes(tag)) {
      newTags = currentTags.filter(t => t !== tag);
    } else {
      newTags = [...currentTags, tag].sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        return isNaN(numA) || isNaN(numB) ? a.localeCompare(b) : numA - numB;
      });
    }
    setFormData({ ...formData, role_tags: newTags.join(',') });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert('姓名與電子信箱為必填欄位');
      return;
    }

    setIsSaving(true);
    try {
      if (editingStaff) {
        // Edit existing staff
        const res = await fetch('/api/staff', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(currentUid)
          },
          body: JSON.stringify({
            id: editingStaff.id,
            updates: {
              name: formData.name.trim(),
              email: formData.email.trim().toLowerCase(),
              department: formData.department.trim(),
              title: formData.title.trim(),
              class_assigned: formData.class_assigned.trim(),
              role_tags: formData.role_tags.trim()
            }
          })
        });

        if (res.ok) {
          setIsModalOpen(false);
          fetchStaff();
        } else {
          const err = await res.json();
          alert('更新失敗: ' + (err.error || '未知錯誤'));
        }
      } else {
        // Add new staff
        const res = await fetch('/api/staff', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(currentUid)
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            department: formData.department.trim(),
            title: formData.title.trim(),
            class_assigned: formData.class_assigned.trim(),
            role_tags: formData.role_tags.trim()
          })
        });

        if (res.ok) {
          setIsModalOpen(false);
          fetchStaff();
        } else {
          const err = await res.json();
          alert('新增失敗: ' + (err.error || '未知錯誤'));
        }
      }
    } catch (err) {
      console.error(err);
      alert('系統操作失敗');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`確定要完全刪除 ${name} 的白名單帳號嗎？`)) return;
    try {
      const res = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUid)
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchStaff();
      } else {
        const err = await res.json();
        alert('刪除失敗: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnbind = async (id, name) => {
    if (!window.confirm(`確定要解除 ${name} 的 LINE 綁定嗎？解除後該同仁可重新透過 LINE 綁定新帳號。`)) return;
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUid)
        },
        body: JSON.stringify({ id, updates: { line_uid: null } })
      });
      if (res.ok) {
        fetchStaff();
      } else {
        const err = await res.json();
        alert('解除綁定失敗: ' + err.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter staff list
  const filteredStaff = staff.filter(s => {
    const matchSearch = searchTerm === '' ||
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchDept = selectedDeptFilter === 'all' || s.department?.includes(selectedDeptFilter);
    return matchSearch && matchDept;
  });

  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200';
  const textColor = isDark ? 'text-stone-100' : 'text-stone-900';
  const subTextColor = isDark ? 'text-stone-400' : 'text-stone-500';

  return (
    <div className={`rounded-2xl shadow-sm p-4 sm:p-6 border ${cardBg}`}>
      {/* 頂部標題與新增按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-stone-200/70 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-lg font-extrabold ${textColor}`}>
                教職員白名單與權限線上管理
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                最高管理者專用
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${subTextColor}`}>
              可隨時線上新增同仁、編輯處室職稱、即時設定 0~10 角色權限標籤與解綁 LINE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700 transition shadow-xs active:scale-[0.98]"
            title="自訂全校處室清單與角色權限標籤"
          >
            <Settings size={14} className="text-purple-600 dark:text-purple-400" />
            <span>處室與標籤管理</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm active:scale-[0.98]"
          >
            <UserPlus size={15} />
            <span>新增白名單同仁</span>
          </button>
        </div>
      </div>

      {/* 搜尋與處室篩選列 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* 關鍵字搜尋 */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋同仁姓名、電子信箱、職稱或處室..."
            className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-purple-500 ${
              isDark 
                ? 'bg-slate-800/80 border-slate-700 text-stone-100 placeholder-stone-400' 
                : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'
            }`}
          />
        </div>

        {/* 處室篩選膠囊選單 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
          <button
            onClick={() => setSelectedDeptFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedDeptFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            全部 ({staff.length})
          </button>
          {allDepartments.map(dept => {
            const count = staff.filter(s => s.department?.includes(dept)).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDeptFilter(dept)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedDeptFilter === dept
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {dept} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 名單列表 */}
      {isLoading ? (
        <div className="text-center py-10">
          <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-purple-600 dark:text-purple-400 font-bold text-xs">載入教職員白名單中...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl border-stone-300 dark:border-slate-800">
          <p className={`${subTextColor} text-xs font-bold`}>
            {searchTerm ? '找不到符合搜尋條件之教職員' : '目前尚無教職員資料，請點擊上方按鈕新增'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredStaff.map(s => {
            const tags = s.role_tags ? s.role_tags.split(',').map(t => t.trim()).filter(Boolean) : [];
            const isBound = !!s.line_uid;

            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition ${
                  isDark
                    ? 'border-slate-800 bg-slate-800/60 hover:border-slate-700'
                    : 'border-stone-200 bg-stone-50/80 hover:border-stone-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`text-base font-black ${textColor}`}>
                          {s.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-stone-300">
                          {s.department || '未設定處室'}
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                        {s.title || '無職稱'} {s.class_assigned && `· 任教 ${s.class_assigned}`}
                      </p>
                      <p className="text-xs text-stone-400 font-mono mt-0.5 break-all">
                        {s.email}
                      </p>
                    </div>

                    {/* LINE 綁定狀態徽章 */}
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border flex-shrink-0 ${
                      isBound
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    }`}>
                      {isBound ? <Check size={12} /> : <X size={12} />}
                      {isBound ? '已綁定LINE' : '未綁定'}
                    </span>
                  </div>

                  {/* 權限標籤群 */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-stone-400">權限標籤:</span>
                    {tags.length === 0 ? (
                      <span className="text-[11px] text-stone-400 italic">無</span>
                    ) : (
                      tags.map(t => {
                        const roleObj = allRoleTags.find(r => r.tag === t);
                        return (
                          <span
                            key={t}
                            className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold border border-purple-200 dark:border-purple-800 ${
                              roleObj ? roleObj.color : 'bg-stone-200 text-stone-800'
                            }`}
                          >
                            {roleObj ? roleObj.label : `Role ${t}`}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 底部操作列 */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/50 dark:border-slate-800/80">
                  <button
                    onClick={() => handleOpenEditModal(s)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                  >
                    <Edit3 size={13} />
                    <span>線上編修</span>
                  </button>

                  {isBound && (
                    <button
                      onClick={() => handleUnbind(s.id, s.name)}
                      title="解除 LINE 綁定，允許同仁重新連線"
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-200 dark:border-amber-800 transition"
                    >
                      <Unlink size={13} />
                      <span>解綁</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    title="徹底自白名單刪除"
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-stone-200 dark:border-slate-700 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 線上新增 / 編輯 Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-fade-in ${
            isDark ? 'bg-slate-900 border-slate-700 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-purple-50/70 border-stone-100'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-600 dark:text-purple-400" />
                <h4 className="font-extrabold text-sm">
                  {editingStaff ? `編修教職員資料：${editingStaff.name}` : '新增教職員白名單'}
                </h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例：王小明"
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    電子信箱 (綁定用帳號) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="例：teacher@wutps.ptc.edu.tw"
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-500 dark:text-stone-400">
                      處室 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomDeptInput(!isCustomDeptInput)}
                      className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 font-bold"
                    >
                      <Plus size={11} />
                      <span>{isCustomDeptInput ? '返回選單' : '自訂處室'}</span>
                    </button>
                  </div>

                  {isCustomDeptInput ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customDeptInputText}
                        onChange={(e) => setCustomDeptInputText(e.target.value)}
                        placeholder="例：主計室 / 幼兒園"
                        className={`flex-1 p-2 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                          isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (customDeptInputText.trim()) {
                              handleAddCustomDepartment(customDeptInputText.trim());
                              setFormData({ ...formData, department: customDeptInputText.trim() });
                              setCustomDeptInputText('');
                              setIsCustomDeptInput(false);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customDeptInputText.trim()) {
                            handleAddCustomDepartment(customDeptInputText.trim());
                            setFormData({ ...formData, department: customDeptInputText.trim() });
                            setCustomDeptInputText('');
                            setIsCustomDeptInput(false);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
                      >
                        加入
                      </button>
                    </div>
                  ) : (
                    <select
                      value={formData.department}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomDeptInput(true);
                        } else {
                          setFormData({ ...formData, department: e.target.value });
                        }
                      }}
                      className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                      }`}
                    >
                      {allDepartments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      {formData.department && !allDepartments.includes(formData.department) && (
                        <option value={formData.department}>{formData.department} (既有處室)</option>
                      )}
                      <option value="__NEW__">＋ 新增/自訂其他處室...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    職稱 (可直接自訂鍵入)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例：教務主任 / 導師 / 技工"
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-500 dark:text-stone-400">
                      任教班級 (12班選單)
                    </label>
                    {formData.class_assigned && (
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                        自動標記導師(4)
                      </span>
                    )}
                  </div>
                  <select
                    value={formData.class_assigned}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  >
                    <option value="">無 / 非班級導師 (科任/行政)</option>
                    <optgroup label="── 霧臺國小本校 ──">
                      {['一甲', '二甲', '三甲', '四甲', '五甲', '六甲'].map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </optgroup>
                    <optgroup label="── 勵古百合分校 ──">
                      {['一乙', '二乙', '三乙', '四乙', '五乙', '六乙'].map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </optgroup>
                    {formData.class_assigned && !WUTPS_CLASSES.includes(formData.class_assigned) && (
                      <optgroup label="── 既有/非標準班級 ──">
                        <option value={formData.class_assigned}>{formData.class_assigned}</option>
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* 權限標籤線上點選器 */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400">
                    角色權限標籤 (點擊快速賦予 / 取消)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfigModalOpen(true);
                      setConfigTab('tags');
                    }}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <Settings size={11} />
                    <span>管理自訂標籤</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl border bg-stone-50 dark:bg-slate-800/50 border-stone-200 dark:border-slate-700 max-h-64 overflow-y-auto space-y-3">
                  {/* 1. 職務與教學角色 (0~10) */}
                  <div>
                    <span className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5">
                      1. 職務角色與專任教學 (可複選)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {allRoleTags.filter(r => !['20', '30', '40', '50', '60'].includes(r.tag)).map(({ tag, label }) => {
                        const isChecked = formData.role_tags
                          ?.split(/[,，、\s]+/)
                          .map(t => t.trim())
                          .includes(tag);

                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => handleToggleRoleTag(tag)}
                            className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border transition text-left ${
                              isChecked
                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="truncate mr-1">{label}</span>
                            {isChecked && <Check size={13} className="text-white flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. 所屬處室單位 (20~60) */}
                  <div className="pt-2 border-t border-stone-200/60 dark:border-slate-700/60">
                    <span className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5">
                      2. 所屬處室單位 (可複選)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {allRoleTags.filter(r => ['20', '30', '40', '50', '60'].includes(r.tag)).map(({ tag, label }) => {
                        const isChecked = formData.role_tags
                          ?.split(/[,，、\s]+/)
                          .map(t => t.trim())
                          .includes(tag);

                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => handleToggleRoleTag(tag)}
                            className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border transition text-left ${
                              isChecked
                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            <span className="truncate mr-1">{label}</span>
                            {isChecked && <Check size={13} className="text-white flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 快速新增自訂標籤 */}
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={customTagInputText}
                    onChange={(e) => setCustomTagInputText(e.target.value)}
                    placeholder="新增自訂標籤 (例: 15 課後班 或 99)"
                    className={`flex-1 p-2 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTagFromInline();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTagFromInline}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>新增並選取</span>
                  </button>
                </div>

                {/* 進階手動編輯標籤字串 */}
                <div className="mt-2.5 pt-2 border-t border-stone-200/60 dark:border-slate-700/60 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-stone-400 whitespace-nowrap">進階手動編輯:</span>
                  <input
                    type="text"
                    value={formData.role_tags}
                    onChange={(e) => setFormData({ ...formData, role_tags: e.target.value })}
                    placeholder="以逗號分隔，如 2,20 或 4,20"
                    className={`flex-1 px-2.5 py-1 text-xs font-mono rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-purple-300' : 'bg-white border-stone-300 text-purple-700'
                    }`}
                  />
                </div>

                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                  💡 <strong>標籤複選說明</strong>：同仁可同時擁有職務與處室標籤（如：<code>2,20</code> 代表教導主任、<code>3,40</code> 代表總務處組長、<code>4,20</code> 代表國小部導師、<code>4,60</code> 代表幼兒園導師、<code>0,2,20</code> 代表兼任管理員之主任）。
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-stone-200 transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{isSaving ? '儲存中...' : '確認儲存'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 專屬「處室與角色標籤管理」Modal ── */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-fade-in ${
            isDark ? 'bg-slate-900 border-slate-700 text-stone-100' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-purple-50/70 border-stone-100'
            }`}>
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-purple-600 dark:text-purple-400" />
                <h4 className="font-extrabold text-sm">全校處室與角色標籤自訂管理</h4>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* 分頁切換 */}
            <div className="flex border-b border-stone-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfigTab('departments')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  configTab === 'departments'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <Building2 size={14} />
                <span>處室清單 ({allDepartments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('tags')}
                className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  configTab === 'tags'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <Tag size={14} />
                <span>角色標籤 ({allRoleTags.length})</span>
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {configTab === 'departments' ? (
                <>
                  <div>
                    <h5 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2">
                      現有處室清單（可用於同仁分類與首頁篩選）
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {allDepartments.map(dept => {
                        const isDefault = DEFAULT_DEPARTMENTS.includes(dept);
                        const isCustom = customDepartments.includes(dept);
                        const staffCount = staff.filter(s => s.department?.includes(dept)).length;

                        return (
                          <div
                            key={dept}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-stone-200'
                                : 'bg-stone-50 border-stone-200 text-stone-800'
                            }`}
                          >
                            <span>{dept}</span>
                            {staffCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                {staffCount}人
                              </span>
                            )}
                            {isDefault ? (
                              <span className="text-[10px] text-stone-400 font-normal">
                                (預設)
                              </span>
                            ) : isCustom ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomDepartment(dept)}
                                title="刪除此自訂處室"
                                className="text-stone-400 hover:text-red-500 transition ml-0.5"
                              >
                                <X size={12} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-normal">
                                (既有同仁)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 新增處室輸入框 */}
                  <div className="pt-3 border-t border-stone-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1.5">
                      新增自訂處室
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDeptInput}
                        onChange={(e) => setNewDeptInput(e.target.value)}
                        placeholder="輸入處室名稱，例如：主計室、幼兒園、專案辦公室"
                        className={`flex-1 p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                          isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newDeptInput.trim()) {
                              handleAddCustomDepartment(newDeptInput.trim());
                              setNewDeptInput('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newDeptInput.trim()) {
                            handleAddCustomDepartment(newDeptInput.trim());
                            setNewDeptInput('');
                          }
                        }}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition"
                      >
                        <Plus size={14} />
                        <span>新增</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">
                      自訂處室將儲存於您的瀏覽器快取中，並即時顯示於下拉選單與篩選列。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h5 className="text-xs font-bold text-stone-500 dark:text-stone-400 mb-2">
                      現有角色權限標籤清單
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allRoleTags.map(({ tag, label, color, isCustom }) => {
                        const isDefault = DEFAULT_ROLE_TAGS.some(r => r.tag === tag);
                        return (
                          <div
                            key={tag}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold ${
                              isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-stone-50 border-stone-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${color}`}>
                                {tag}
                              </span>
                              <span className="truncate">{label}</span>
                            </div>
                            {isDefault ? (
                              <span className="text-[10px] text-stone-400 font-normal whitespace-nowrap ml-1">
                                (預設)
                              </span>
                            ) : isCustom ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomRoleTag(tag)}
                                title="刪除此自訂標籤"
                                className="text-stone-400 hover:text-red-500 transition ml-1 p-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-normal whitespace-nowrap ml-1">
                                (同仁既有)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 新增角色標籤輸入框 */}
                  <div className="pt-3 border-t border-stone-200 dark:border-slate-800">
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1.5">
                      新增自訂角色權限標籤
                    </label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <input
                          type="text"
                          value={newTagCodeInput}
                          onChange={(e) => setNewTagCodeInput(e.target.value)}
                          placeholder="代碼 (例: 15)"
                          className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                          }`}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={newTagLabelInput}
                          onChange={(e) => setNewTagLabelInput(e.target.value)}
                          placeholder="說明 (例: 課後照顧班教師)"
                          className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                            isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                          }`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newTagCodeInput.trim()) {
                                handleAddCustomRoleTag(newTagCodeInput.trim(), newTagLabelInput.trim());
                                setNewTagCodeInput('');
                                setNewTagLabelInput('');
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagCodeInput.trim()) {
                          handleAddCustomRoleTag(newTagCodeInput.trim(), newTagLabelInput.trim());
                          setNewTagCodeInput('');
                          setNewTagLabelInput('');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition"
                    >
                      <Plus size={14} />
                      <span>新增此權限標籤</span>
                    </button>
                    <p className="text-[11px] text-stone-400 mt-1.5">
                      標籤代碼將儲存至資料庫的 <code>role_tags</code> 欄位，方便依特定標籤賦予系統功能或群組廣播。
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-xs"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
