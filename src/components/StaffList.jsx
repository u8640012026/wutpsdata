import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { 
  Check, 
  X, 
  ShieldCheck, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Unlink, 
  Search, 
  Filter, 
  Save, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

const DEPARTMENTS = [
  '校長室',
  '教務處',
  '學務處',
  '總務處',
  '人事室',
  '勵古百合分校',
  '幼兒園',
  '專案/兼任'
];

const AVAILABLE_ROLE_TAGS = [
  { tag: '0', label: '0 系統管理員', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  { tag: '1', label: '1 校長', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { tag: '2', label: '2 處室主任', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { tag: '3', label: '3 業務組長', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { tag: '4', label: '4 班級導師', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  { tag: '6', label: '6 族語教師', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  { tag: '7', label: '7 英語教師', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  { tag: '9', label: '9 特教教師', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
  { tag: '10', label: '10 輔導教師', color: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300' }
];

export default function StaffList() {
  const { isDark } = useApp();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUid, setCurrentUid] = useState('dev-admin');

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

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      let uid = 'dev-admin';
      if (window.liff?.isLoggedIn()) {
        const profile = await window.liff.getProfile();
        uid = profile.userId;
      }
      setCurrentUid(uid);

      const response = await fetch('/api/staff', {
        headers: { 'x-line-uid': uid }
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
    setFormData({
      name: '',
      email: '',
      department: '教務處',
      title: '',
      class_assigned: '',
      role_tags: '4'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingStaff(member);
    setFormData({
      name: member.name || '',
      email: member.email || '',
      department: member.department || '教務處',
      title: member.title || '',
      class_assigned: member.class_assigned || '',
      role_tags: member.role_tags || ''
    });
    setIsModalOpen(true);
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
            'x-line-uid': currentUid
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
            'x-line-uid': currentUid
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
          'x-line-uid': currentUid 
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
          'x-line-uid': currentUid 
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

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm self-start sm:self-auto active:scale-[0.98]"
        >
          <UserPlus size={15} />
          <span>新增白名單同仁</span>
        </button>
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedDeptFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedDeptFilter === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            全部處室 ({staff.length})
          </button>
          {['教務', '學務', '總務', '校長', '勵古', '人事'].map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDeptFilter(dept)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedDeptFilter === dept
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              {dept}
            </button>
          ))}
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
                        const roleObj = AVAILABLE_ROLE_TAGS.find(r => r.tag === t);
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
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    處室
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    職稱
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例：教務主任 / 導師"
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 mb-1">
                    任教班級 (若無則留空)
                  </label>
                  <input
                    type="text"
                    value={formData.class_assigned}
                    onChange={(e) => setFormData({ ...formData, class_assigned: e.target.value })}
                    placeholder="例：3A / 一甲"
                    className={`w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-purple-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-stone-100' : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                </div>
              </div>

              {/* 權限標籤線上點選器 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-500 dark:text-stone-400">
                    角色權限標籤 (點擊按鈕快速賦予 / 取消)
                  </label>
                  <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                    當前標籤值: {formData.role_tags || '無'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl border bg-stone-50 dark:bg-slate-800/50 border-stone-200 dark:border-slate-700">
                  {AVAILABLE_ROLE_TAGS.map(({ tag, label }) => {
                    const isChecked = formData.role_tags
                      ?.split(',')
                      .map(t => t.trim())
                      .includes(tag);

                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => handleToggleRoleTag(tag)}
                        className={`p-2 rounded-lg text-xs font-bold flex items-center justify-between border transition ${
                          isChecked
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <span>{label}</span>
                        {isChecked && <Check size={13} className="text-white" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  💡 說明：0 為最高管理員、1 為校長、2 為主任、3 為組長、4 為導師，支援複選（如：2,3 代表主任兼組長）。
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
    </div>
  );
}
