import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const GAS_URL = process.env.CALENDAR_GAS_URL || 'https://script.google.com/macros/s/AKfycbwqB0mHhuLrzUrpe2M7ngW4_97_sQ2VN_MukBetf8sesqG1sJXEX0BIQDxgfOe7L7P3/exec';

// 從 GAS 拉取所有活動的輔助函式（供降級回退與雙向同步使用）
async function fetchEventsFromGas(targetTypes = ['all', 'wutai', 'ligu']) {
  const fetchPromises = targetTypes.map(async (t) => {
    try {
      const r = await fetch(`${GAS_URL}?type=${t}`);
      if (r.ok) {
        const data = await r.json();
        if (data.status === 'success' && Array.isArray(data.data)) {
          return data.data.map(item => ({
            ...item,
            calendarType: item.calendarType || t
          }));
        }
      }
      return [];
    } catch (err) {
      console.warn(`Fetch calendar type ${t} from GAS failed:`, err.message);
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);
  const eventMap = new Map();
  results.flat().forEach(ev => {
    if (ev && ev.id) {
      eventMap.set(ev.id, ev);
    }
  });

  const combinedEvents = Array.from(eventMap.values());
  combinedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  return combinedEvents;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ── 讀取活動 (GET)：優先 Supabase，若無資料或異常則降級回 GAS ──
    if (req.method === 'GET') {
      const type = (req.query.type || 'all').toLowerCase();

      let targetTypes = ['all', 'wutai', 'ligu'];
      if (type === 'wutai') {
        targetTypes = ['all', 'wutai'];
      } else if (type === 'ligu') {
        targetTypes = ['all', 'ligu'];
      } else if (type === 'only_all') {
        targetTypes = ['all'];
      }

      // 1. 優先嘗試從 Supabase calendar_events 讀取（毫秒級極速回應）
      try {
        let query = supabase.from('calendar_events').select('*');
        if (type === 'wutai') {
          query = query.in('calendar_type', ['all', 'wutai']);
        } else if (type === 'ligu') {
          query = query.in('calendar_type', ['all', 'ligu']);
        } else if (type === 'only_all') {
          query = query.eq('calendar_type', 'all');
        }
        query = query.order('start_time', { ascending: true });

        const { data: dbEvents, error: dbError } = await query;
        if (!dbError && Array.isArray(dbEvents) && dbEvents.length > 0) {
          const mapped = dbEvents.map(ev => ({
            id: ev.id,
            gcal_event_id: ev.gcal_event_id || ev.id,
            calendarType: ev.calendar_type,
            title: ev.title,
            location: ev.location || '',
            description: ev.description || '',
            start: ev.start_time,
            end: ev.end_time || ev.start_time,
            isAllDay: Boolean(ev.is_all_day),
            periodInfo: ev.period_info || '',
            targetGrades: ev.target_grades || '全校所有班級',
            department: ev.department || '教務處',
            creatorName: ev.creator_name || ''
          }));

          return res.status(200).json({
            status: 'success',
            filter: type,
            source: 'supabase',
            count: mapped.length,
            data: mapped
          });
        }
      } catch (dbEx) {
        console.warn('Supabase calendar query fallback to GAS:', dbEx.message);
      }

      // 2. 降級備援：若 Supabase 尚未建表或為空，平滑回退向 GAS 查詢
      const combinedEvents = await fetchEventsFromGas(targetTypes);
      return res.status(200).json({
        status: 'success',
        filter: type,
        source: 'gas',
        count: combinedEvents.length,
        data: combinedEvents
      });
    }

    // 解析 Payload
    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error('Body parse error:', e);
      }
    }

    // ── 從 Google 日曆單向/雙向拉取最新行程至 Supabase ──
    if (req.method === 'POST' && payload?.action === 'sync_from_gas') {
      const gasEvents = await fetchEventsFromGas(['all', 'wutai', 'ligu']);
      let syncedCount = 0;
      for (const ev of gasEvents) {
        try {
          const { error } = await supabase.from('calendar_events').upsert({
            gcal_event_id: ev.id,
            calendar_type: ev.calendarType || 'all',
            title: ev.title || '未命名活動',
            location: ev.location || '',
            start_time: ev.start,
            end_time: ev.end || ev.start,
            is_all_day: Boolean(ev.isAllDay),
            description: ev.description || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'gcal_event_id' });

          if (!error) syncedCount++;
        } catch (syncErr) {
          console.error('Event sync error:', syncErr.message);
        }
      }

      return res.status(200).json({
        status: 'success',
        message: `成功從 Google 日曆同步 ${syncedCount} 筆活動至 Supabase`,
        syncedCount
      });
    }

    // ── 刪除活動 (DELETE 或 POST with action: 'delete') ──
    if (req.method === 'DELETE' || (req.method === 'POST' && payload?.action === 'delete')) {
      const { eventId, calendarType } = payload || {};
      if (!eventId) {
        return res.status(400).json({ status: 'error', message: '缺少 eventId' });
      }

      let gcalId = eventId;
      try {
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id, gcal_event_id, calendar_type')
          .or(`id.eq.${eventId},gcal_event_id.eq.${eventId}`)
          .maybeSingle();

        if (existing) {
          gcalId = existing.gcal_event_id || eventId;
          await supabase.from('calendar_events').delete().eq('id', existing.id);
        }
      } catch (dbDelErr) {
        console.warn('Supabase delete warning:', dbDelErr.message);
      }

      // 背景非同步通知 GAS 刪除 Google 日曆事件 (Fire-and-forget)
      if (gcalId) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            eventId: gcalId,
            calendarType: calendarType || 'all'
          })
        }).catch(err => console.warn('Background GAS delete failed:', err.message));
      }

      return res.status(200).json({ status: 'success', message: '活動已刪除' });
    }

    // ── 編輯活動 (PUT 或 POST with action: 'update') ──
    if (req.method === 'PUT' || (req.method === 'POST' && payload?.action === 'update')) {
      const { eventId, calendarType, title, location, description, startTime, endTime, isAllDay } = payload || {};
      if (!eventId || !title || !startTime) {
        return res.status(400).json({ status: 'error', message: '缺少活動 ID (eventId)、名稱 (title) 或開始時間 (startTime)' });
      }

      let gcalId = eventId;
      try {
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id, gcal_event_id')
          .or(`id.eq.${eventId},gcal_event_id.eq.${eventId}`)
          .maybeSingle();

        if (existing) {
          gcalId = existing.gcal_event_id || eventId;
          await supabase.from('calendar_events').update({
            calendar_type: calendarType || 'all',
            title: title.trim(),
            location: (location || '').trim(),
            description: (description || '').trim(),
            start_time: startTime,
            end_time: endTime || startTime,
            is_all_day: Boolean(isAllDay),
            updated_at: new Date().toISOString()
          }).eq('id', existing.id);
        }
      } catch (dbUpErr) {
        console.warn('Supabase update warning:', dbUpErr.message);
      }

      // 背景非同步通知 GAS 更新 Google 日曆事件 (Fire-and-forget)
      if (gcalId) {
        fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            eventId: gcalId,
            calendarType: calendarType || 'all',
            title: title.trim(),
            location: location ? location.trim() : '',
            description: description ? description.trim() : '',
            startTime,
            endTime: endTime || startTime,
            isAllDay: Boolean(isAllDay)
          })
        }).catch(err => console.warn('Background GAS update failed:', err.message));
      }

      return res.status(200).json({ status: 'success', message: '活動已更新' });
    }

    // ── 新增活動 (POST) ──
    if (req.method === 'POST') {
      const { 
        calendarType, title, location, description, startTime, endTime, isAllDay,
        periodInfo, targetGrades, department, creatorName, creatorUid 
      } = payload || {};

      if (!title || !startTime) {
        return res.status(400).json({ status: 'error', message: '缺少活動名稱 (title) 或開始時間 (startTime)' });
      }

      let insertedId = null;
      try {
        const { data: newRow, error: insertError } = await supabase
          .from('calendar_events')
          .insert([{
            calendar_type: calendarType || 'all',
            title: title.trim(),
            location: (location || '').trim(),
            description: (description || '').trim(),
            start_time: startTime,
            end_time: endTime || startTime,
            is_all_day: Boolean(isAllDay),
            period_info: periodInfo || '',
            target_grades: targetGrades || '全校所有班級',
            department: department || '教務處',
            creator_name: creatorName || '',
            creator_uid: creatorUid || ''
          }])
          .select()
          .single();

        if (!insertError && newRow) {
          insertedId = newRow.id;
        }
      } catch (dbInsErr) {
        console.warn('Supabase insert warning:', dbInsErr.message);
      }

      // 背景非同步發送給 GAS，取得 Google 日曆 Event ID 並回填 (Fire-and-forget)
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          calendarType: calendarType || 'all',
          title: title.trim(),
          location: location ? location.trim() : '',
          description: description ? description.trim() : '',
          startTime,
          endTime: endTime || startTime,
          isAllDay: Boolean(isAllDay)
        })
      }).then(async gasRes => {
        if (gasRes.ok) {
          const gasData = await gasRes.json();
          if (gasData?.eventId && insertedId) {
            await supabase
              .from('calendar_events')
              .update({ gcal_event_id: gasData.eventId })
              .eq('id', insertedId);
          }
        }
      }).catch(err => console.warn('Background GAS create failed:', err.message));

      // 0.05 秒立即回應前端，前端抽屜無感秒關
      return res.status(200).json({
        status: 'success',
        id: insertedId,
        message: '活動已建立成功'
      });
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
