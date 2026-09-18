import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  X, 
  RefreshCw, 
  Check, 
  Plus, 
  AtSign 
} from 'lucide-react';
import {
  PERIODS,
  WUTAI_LOCATIONS,
  LIGU_LOCATIONS,
  WUTAI_CLASSES,
  LIGU_CLASSES,
  KINDERGARTEN_CLASSES,
  DEPARTMENTS
} from './calendarUtils';

export default function CalendarDrawer({
  isOpen,
  editingEventId,
  formData,
  setFormData,
  isSubmitting,
  submitSuccess,
  staffList,
  onClose,
  onSubmit,
  setQuickDate,
  toggleClass
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          {/* 遮罩背景 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && onClose()}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* 抽屜本體 */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-16">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-screen max-w-lg bg-white dark:bg-slate-900 border-l border-stone-200 dark:border-slate-800 shadow-2xl flex flex-col h-[100dvh] overflow-hidden"
            >
              {/* 抽屜頂部 Header */}
              <div className="p-5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                      {editingEventId ? '編輯校務行事活動' : '新增校務行事活動'}
                    </h3>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500">
                      {editingEventId ? '修改將即時同步至 Google 官方日曆' : '將即時寫入 Google 全校官方日曆'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 抽屜表單本體 (Flex-1 結構，按鈕永久固定在底端) */}
              <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 可滾動的輸入內容區塊 */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* 1. 所屬行事曆（三選一） */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      所屬行事曆
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'all' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'all'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        全校共通
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'wutai' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'wutai'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        霧臺校區
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, calendarType: 'ligu' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.calendarType === 'ligu'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        勵古百合
                      </button>
                    </div>
                  </div>

                  {/* 2. 活動名稱 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                      <span>活動名稱</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例：全校行政晨會、期中學習評量、親職教育日"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 3. 活動日期 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        活動日期
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickDate('tomorrow')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200"
                        >
                          明日
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickDate('next_monday')}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200"
                        >
                          下週一
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 4. 時間模式選擇 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      時間排程模式
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'all_day' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'all_day'
                            ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        整天 / 半天
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'periods' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'periods'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        依作息節次
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, timeMode: 'custom' }))}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          formData.timeMode === 'custom'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        自訂時段
                      </button>
                    </div>

                    {/* 依不同時間模式展開子設定 */}
                    {formData.timeMode === 'all_day' && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 flex items-center justify-around text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'full'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'full' }))}
                            className="text-emerald-600"
                          />
                          <span>全天</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'morning'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'morning' }))}
                            className="text-emerald-600"
                          />
                          <span>上午半天</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="allDayType"
                            checked={formData.allDayType === 'afternoon'}
                            onChange={() => setFormData(prev => ({ ...prev, allDayType: 'afternoon' }))}
                            className="text-emerald-600"
                          />
                          <span>下午半天</span>
                        </label>
                      </div>
                    )}

                    {formData.timeMode === 'periods' && (
                      <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">開始節次</label>
                            <select
                              value={formData.startPeriod}
                              onChange={(e) => setFormData(prev => ({ ...prev, startPeriod: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            >
                              {PERIODS.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.start})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">結束節次</label>
                            <select
                              value={formData.endPeriod}
                              onChange={(e) => setFormData(prev => ({ ...prev, endPeriod: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                            >
                              {PERIODS.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.end})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.timeMode === 'custom' && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">開始時間</label>
                          <input
                            type="time"
                            value={formData.customStartTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, customStartTime: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-stone-500 dark:text-stone-400 block mb-1">結束時間</label>
                          <input
                            type="time"
                            value={formData.customEndTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, customEndTime: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 5. 地點選擇與快捷點選 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      活動地點
                    </label>
                    <input
                      type="text"
                      placeholder="例：視聽教室、風雨球場、全校操場"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />

                    {/* 依校區提供推薦地點 */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(formData.calendarType === 'ligu' ? LIGU_LOCATIONS : WUTAI_LOCATIONS).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                            formData.location === loc
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 6. 對象班級點陣快速勾選 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        對象班級
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isAllClasses: !prev.isAllClasses, selectedClasses: [] }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                          formData.isAllClasses
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        全校所有班級
                      </button>
                    </div>

                    {!formData.isAllClasses && (
                      <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 space-y-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">霧臺國小本校</span>
                          <div className="grid grid-cols-6 gap-1.5">
                            {WUTAI_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition text-center ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">勵古百合分校</span>
                          <div className="grid grid-cols-6 gap-1.5">
                            {LIGU_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 rounded-lg text-[11px] font-bold border transition text-center ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-stone-400 block mb-1">幼兒園</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {KINDERGARTEN_CLASSES.map(cls => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => toggleClass(cls)}
                                className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition text-center truncate ${
                                  formData.selectedClasses.includes(cls)
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 7. 主辦處室 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      承辦處室
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* 8. 備註與詳細說明 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                      備註與注意事項
                    </label>
                    <textarea
                      rows={3}
                      placeholder="填寫活動詳細說明、裝備需求或相關流程 (可使用 @姓名 標記相關同仁)..."
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                    {staffList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                          <AtSign size={12} className="text-emerald-600" />
                          標記同仁：
                        </span>
                        {staffList.slice(0, 6).map(s => (
                          <button
                            key={s.id || s.name}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, notes: prev.notes + (prev.notes.endsWith(' ') || !prev.notes ? '' : ' ') + `@${s.name} ` }))}
                            className="text-[11px] px-2 py-0.5 rounded-md border font-semibold bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 hover:bg-emerald-50 hover:text-emerald-800 transition active:scale-95"
                          >
                            @{s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 抽屜底層固定送出列 (Sticky / 獨立 Flex 底欄，帶毛玻璃與充足安全邊距，絕不被遮擋) */}
                <div className="p-4 bg-white/95 dark:bg-slate-900/95 border-t border-stone-100 dark:border-slate-800 backdrop-blur-md shrink-0 pb-8 sm:pb-5">
                  <button
                    type="submit"
                    disabled={isSubmitting || submitSuccess}
                    className={`w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] ${
                      submitSuccess
                        ? 'bg-emerald-700 shadow-emerald-700/25'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                    }`}
                  >
                    {submitSuccess ? (
                      <>
                        <Check size={16} />
                        <span>{editingEventId ? '更新成功！已同步至 Google 日曆' : '發布成功！已同步至 Google 日曆'}</span>
                      </>
                    ) : isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>正在同步至 Google 日曆...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        <span>{editingEventId ? '確認並儲存修改' : '確認並發布至 Google 日曆'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
