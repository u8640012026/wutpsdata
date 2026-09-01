import React from 'react';
import { useApp } from '../App';

export default function Timeline({ events }) {
  const { isDark, t } = useApp();

  if (!events || events.length === 0) {
    return <p className={`text-sm py-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.noEvent}</p>;
  }

  return (
    <div className="relative border-l-2 border-blue-200 ml-3 mt-4 space-y-6">
      {events.map((event, index) => (
        <div key={index} className="relative pl-6">
          <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-800"></div>
          <div className={`p-3 rounded shadow-sm border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-blue-400 font-semibold">{event.date}</p>
            <h4 className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>{event.title}</h4>
            {event.description && (
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
