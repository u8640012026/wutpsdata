import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  X, 
  Edit2, 
  Trash2 
} from 'lucide-react';
import { getCalendarBadge, formatEventDate, formatEventTime } from './calendarUtils';
import { renderContentWithLinksAndMentions } from '../../lib/mentionHelper';

export default function EventDetailModal({
  selectedEvent,
  currentUserName,
  isDark,
  canMod,
  isSubmitting,
  onClose,
  onEdit,
  onDelete
}) {
  return (
    <AnimatePresence>
      {selectedEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getCalendarBadge(selectedEvent.calendarType).badge}`}>
                  {getCalendarBadge(selectedEvent.calendarType).label}
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300 border-y border-stone-100 dark:border-slate-800/80 py-3">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-stone-400 shrink-0" />
                  <span className="font-semibold">
                    {formatEventDate(selectedEvent.start).full} ({formatEventDate(selectedEvent.start).weekday})
                    {formatEventDate(selectedEvent.start).schoolWeek && (
                      <span className="ml-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        · {formatEventDate(selectedEvent.start).schoolWeek}
                      </span>
                    )}
                  </span>
                </p>
                {formatEventDate(selectedEvent.start).relative && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${formatEventDate(selectedEvent.start).relative.color}`}>
                    {formatEventDate(selectedEvent.start).relative.label}
                  </span>
                )}
              </div>
              <p className="flex items-center gap-2">
                <Clock size={14} className="text-stone-400 shrink-0" />
                <span>{formatEventTime(selectedEvent)}</span>
              </p>
              {selectedEvent.location && (
                <p className="flex items-center gap-2">
                  <MapPin size={14} className="text-stone-400 shrink-0" />
                  <span>{selectedEvent.location}</span>
                </p>
              )}
            </div>

            {selectedEvent.description && (
              <div className="text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-slate-800/60 p-3 rounded-xl whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {renderContentWithLinksAndMentions(selectedEvent.description, currentUserName, isDark)}
              </div>
            )}

            {/* 權限按鈕組：Role 0 超管全權限 / 建立者可編修 */}
            <div className="pt-2 flex items-center gap-2">
              {canMod ? (
                <>
                  <button
                    onClick={() => onEdit(selectedEvent)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 flex items-center justify-center gap-1.5 border border-blue-200 dark:border-blue-800 transition"
                  >
                    <Edit2 size={13} />
                    <span>編輯活動</span>
                  </button>
                  <button
                    onClick={() => onDelete(selectedEvent.id, selectedEvent.calendarType)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60 flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-800 transition"
                  >
                    <Trash2 size={13} />
                    <span>{isSubmitting ? '刪除中...' : '刪除此活動'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200"
                >
                  關閉
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
