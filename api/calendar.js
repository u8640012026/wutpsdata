import { createClient } from '@supabase/supabase-js';
import { authenticateApiRequest } from './line_auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const GAS_URL = process.env.CALENDAR_GAS_URL || 'https://script.google.com/macros/s/AKfycbwqB0mHhuLrzUrpe2M7ngW4_97_sQ2VN_MukBetf8sesqG1sJXEX0BIQDxgfOe7L7P3/exec';

// 從 GAS 拉取所有活動的輔助函式（供降級回退與雙向同步使用，內建中斷重試機制）
async function fetchEventsFromGas(targetTypes = ['all', 'wutai', 'ligu']) {
  const fetchPromises = targetTypes.map(async (t) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
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
      } catch (err) {
        if (attempt === 2) {
          console.warn(`Fetch calendar type ${t} from GAS failed after retry:`, err.message);
        }
      }
    }
    return [];
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-line-uid, x-line-id-token');

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
      }

      // 1. 優先從 Supabase 讀取（毫秒級極速回應）
      try {
        let query = supabase
          .from('calendar_events')
          .select('*')
          .order('start_time', { ascending: true });

        if (type !== 'all') {
          query = query.in('calendar_type', ['all', type]);
        }

        const { data: events, error: dbError } = await query;
        if (!dbError && Array.isArray(events) && events.length > 0) {
          const mapped = events.map(ev => ({
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
          let { data: existing } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('gcal_event_id', ev.id)
            .maybeSingle();

          // 強化比對：包含 calendar_type，防止跨校區同名同時間活動被誤合併
          if (!existing && ev.title && ev.start) {
            const { data: matchByTime } = await supabase
              .from('calendar_events')
              .select('id')
              .eq('title', ev.title)
              .eq('start_time', ev.start)
              .eq('calendar_type', ev.calendarType || 'all')
              .maybeSingle();
            if (matchByTime) {
              existing = matchByTime;
            }
          }

          const eventPayload = {
            gcal_event_id: ev.id,
            calendar_type: ev.calendarType || 'all',
            title: ev.title || '未命名活動',
            location: ev.location || '',
            start_time: ev.start,
            end_time: ev.end || ev.start,
            is_all_day: Boolean(ev.isAllDay),
            description: ev.description || '',
            updated_at: new Date().toISOString()
          };

          if (existing) {
            const { error: updateErr } = await supabase
              .from('calendar_events')
              .update(eventPayload)
              .eq('id', existing.id);
            if (!updateErr) syncedCount++;
            else console.error('Event update error during sync:', updateErr.message);
          } else {
            const { error: insertErr } = await supabase
              .from('calendar_events')
              .insert([eventPayload]);
            if (!insertErr) syncedCount++;
            else console.error('Event insert error during sync:', insertErr.message);
          }
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
      const { data: existing, error: findErr } = await supabase
        .from('calendar_events')
        .select('id, gcal_event_id, calendar_type')
        .or(`id.eq.${eventId},gcal_event_id.eq.${eventId}`)
        .maybeSingle();

      if (findErr) {
        return res.status(500).json({ status: 'error', message: '查詢待刪除活動失敗：' + findErr.message });
      }

      if (existing) {
        gcalId = existing.gcal_event_id || eventId;
        const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', existing.id);
        if (delErr) {
          return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
        }
      } else {
        return res.status(404).json({ status: 'error', message: '查無此活動記錄，無法刪除' });
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
      const { data: existing, error: findErr } = await supabase
        .from('calendar_events')
        .select('id, gcal_event_id')
        .or(`id.eq.${eventId},gcal_event_id.eq.${eventId}`)
        .maybeSingle();

      if (findErr) {
        return res.status(500).json({ status: 'error', message: '查詢活動資料失敗：' + findErr.message });
      }

      if (!existing) {
        return res.status(404).json({ status: 'error', message: '查無此活動記錄，無法更新' });
      }

      gcalId = existing.gcal_event_id || eventId;
      const { error: updateErr } = await supabase.from('calendar_events').update({
        calendar_type: calendarType || 'all',
        title: title.trim(),
        location: (location || '').trim(),
        description: (description || '').trim(),
        start_time: startTime,
        end_time: endTime || startTime,
        is_all_day: Boolean(isAllDay),
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);

      if (updateErr) {
        return res.status(500).json({ status: 'error', message: '更新活動失敗：' + updateErr.message });
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

      if (req.headers && (req.headers['x-line-uid'] || req.headers['x-line-id-token'])) {
        const auth = await authenticateApiRequest(req);
        if (!auth.valid) {
          return res.status(401).json({ status: 'error', message: auth.error });
        }
      }

      // 併發防重複保護：若已存在相同校區、標題與開始時間的活動，直接回傳既有活動，防止連點或同時發送產生重複資料
      const { data: duplicate } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('calendar_type', calendarType || 'all')
        .eq('title', title.trim())
        .eq('start_time', startTime)
        .limit(1)
        .maybeSingle();

      if (duplicate) {
        return res.status(200).json({
          status: 'success',
          message: '活動已存在（防止重複建立）',
          event: duplicate
        });
      }

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

      if (insertError) {
        console.error('Calendar insert error:', insertError.message);
        return res.status(500).json({ status: 'error', message: '資料庫寫入活動失敗：' + insertError.message });
      }

      if (!newRow?.id) {
        return res.status(500).json({ status: 'error', message: '活動新增異常：未能產生有效活動 ID' });
      }

      const insertedId = newRow.id;

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
