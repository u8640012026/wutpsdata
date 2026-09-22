import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  ChevronRight, 
  UserCheck 
} from 'lucide-react';
import { getCalendarBadge, formatEventDate, formatEventTime } from './calendarUtils';
import { isMentioned } from '../../lib/mentionHelper';

export default function CalendarEventCard({
  ev,
  currentUserName,
  readSet,
  canMod,
  onSelect
}) {
  const badgeStyle = getCalendarBadge(ev.calendarType);
  const dateInfo = formatEventDate(ev.start);
  const timeStr = formatEventTime(ev);
  const mentionKey = `calendar:${ev.id}`;
  const isMeMentioned = isMentioned(`${ev.title} ${ev.description || ''}`, currentUserName);
  const isUnread = isMeMentioned && !readSet.has(mentionKey);
  const isExpired = dateInfo.relative?.label === '已過期';

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`p-4 rounded-2xl border shadow-xs hover:shadow-md transition-all cursor-pointer border-l-4 ${badgeStyle.border} ${
        isExpired
          ? 'bg-stone-50/70 dark:bg-slate-900/40 border-stone-200/60 dark:border-slate-800/60 opacity-60 hover:opacity-100'
          : 'bg-white dark:bg-slate-900 border-stone-200 dark:border-slate-800'
      } active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          {/* 左側日期卡塊 (含月份、日期、學期週次) */}
          <div className="w-14 h-14 rounded-xl bg-stone-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-stone-200/60 dark:border-slate-700">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 leading-none mb-0.5">{dateInfo.month}</span>
            <span className="text-lg font-black text-stone-900 dark:text-stone-100 leading-none">{dateInfo.day}</span>
            {dateInfo.schoolWeek && (
              <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 leading-none mt-1">
                {dateInfo.schoolWeek}
              </span>
            )}
          </div>

          {/* 活動主體內容 */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeStyle.badge}`}>
                {badgeStyle.label}
              </span>
              <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                {ev.title}
              </h4>
              {dateInfo.relative && (
                <span className={`text-[10px] px-2 py-0.5 rounded-md ${dateInfo.relative.color}`}>
                  {dateInfo.relative.label}
                </span>
              )}
              {isMeMentioned && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                  isUnread
                    ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800 animate-pulse'
                    : 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-slate-800 dark:text-stone-400 dark:border-slate-700'
                }`}>
                  {isUnread ? '提及您 (未讀)' : '提及您 (已讀)'}
                </span>
              )}
              {canMod && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400 flex items-center gap-1">
                  <UserCheck size={10} />
                  可編修
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <CalendarIcon size={12} />
                {dateInfo.weekday}
                {dateInfo.schoolWeek && <span className="text-stone-400 dark:text-stone-500 font-normal">({dateInfo.schoolWeek})</span>}
              </span>
              {timeStr && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {timeStr}
                </span>
              )}
              {ev.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={12} />
                  {ev.location}
                </span>
              )}
              {ev.department && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 font-medium">
                  {ev.department}
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight size={16} className="text-stone-400 shrink-0 mt-2" />
      </div>
    </motion.div>
  );
}
