import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiRequest } from './line_auth.js';
import { isSuperAdmin, roleTags } from '../src/lib/staffAccess.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'MISSING_SERVICE_ROLE_KEY'
);

const GAS_URL = process.env.CALENDAR_GAS_URL || 'https://script.google.com/macros/s/AKfycbwqB0mHhuLrzUrpe2M7ngW4_97_sQ2VN_MukBetf8sesqG1sJXEX0BIQDxgfOe7L7P3/exec';

// 全域進行中請求互斥鎖 (In-Flight Request Mutex for Concurrency Protection)
const inFlightCreations = new Map();

// 從 GAS 拉取所有活動的輔助函式（具備指數退避重試、逾時控制與失敗真實識別）
async function fetchEventsFromGas(targetTypes = ['all', 'wutai', 'ligu']) {
  let anySuccess = false;
  const errors = [];

  const fetchPromises = targetTypes.map(async (t) => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6秒請求逾時

      try {
        const r = await fetch(`${GAS_URL}?type=${t}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (r.ok) {
          const data = await r.json();
          if (data.status === 'success' && Array.isArray(data.data)) {
            anySuccess = true;
            return data.data.map(item => ({
              ...item,
              calendarType: item.calendarType || t
            }));
          }
        }
        throw new Error(`GAS 端點回傳異常狀態碼: ${r.status}`);
      } catch (err) {
        clearTimeout(timeoutId);
        if (attempt < maxAttempts) {
          const delay = attempt * 150; // 指數退避延遲 (150ms -> 300ms)
          await new Promise(res => setTimeout(res, delay));
        } else {
          errors.push(`校區 ${t} 同步失敗: ${err.message}`);
        }
      }
    }
    return null; // 代表該校區三次重試皆失敗
  });

  const results = await Promise.all(fetchPromises);
  const failedTypes = results.filter(r => r === null);

  // 關鍵：若全部校區請求皆重試失敗，嚴禁假裝成功返回空陣列！
  if (targetTypes.length > 0 && failedTypes.length === targetTypes.length) {
    const errorMsg = `Google 日曆連線中斷或逾時: ${errors.join('; ')}`;
    const err = new Error(errorMsg);
    err.isTotalFailure = true;
    throw err;
  }

  const validResults = results.filter(Array.isArray);
  const eventMap = new Map();
  validResults.flat().forEach(ev => {
    if (ev && ev.id) {
      eventMap.set(ev.id, ev);
    }
  });

  const combinedEvents = Array.from(eventMap.values());
  combinedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  combinedEvents.successfulTypes = targetTypes.filter((t, i) => results[i] !== null);
  combinedEvents.failedTypes = targetTypes.filter((t, i) => results[i] === null);
  combinedEvents.isPartial = combinedEvents.failedTypes.length > 0 && combinedEvents.successfulTypes.length > 0;
  return combinedEvents;
}

// 向 Google Apps Script 發送寫入操作（新增、更新、刪除），支援 6 秒逾時、3 次指數退避重試與業務狀態查驗
async function sendGasWriteWithRetry(payload, maxAttempts = 3) {
  const errors = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`GAS HTTP 狀態碼異常: ${res.status}`);
      }

      const data = await res.json();

      // 嚴格校驗 GAS 回傳之業務狀態 (HTTP 200 下回傳 status: error 亦視為業務失敗)
      if (data && (data.status === 'error' || data.success === false || data.error)) {
        const errorMsg = data.message || data.error || 'Google Apps Script 業務執行失敗';

        // 區分永久性權限/配置錯誤（如 permission denied, unauthorized, invalid_grant），直接提早返回，不再重複重試
        const isPermanent = /permission denied|unauthorized|forbidden|not found|invalid_grant|quota/i.test(errorMsg);
        if (isPermanent) {
          return { success: false, error: errorMsg, isPermanent: true, data };
        }
        throw new Error(errorMsg);
      }

      // 若為新增操作 (create)，另須確認回傳有效之 Google Event ID
      if (payload?.action === 'create' && !data?.eventId && !data?.id) {
        throw new Error('Google Apps Script 回應缺少有效 Google Event ID');
      }

      return { success: true, data };
    } catch (err) {
      clearTimeout(timeoutId);
      errors.push(`第 ${attempt} 次嘗試失敗: ${err.message}`);
      if (attempt < maxAttempts) {
        const delay = attempt * 150;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return { success: false, error: errors.join('; ') };
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
          const activeEvents = events.filter(ev => !['pending_delete', 'failed_delete'].includes(ev.sync_status));
          const mapped = activeEvents.map(ev => ({
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
      try {
        const combinedEvents = await fetchEventsFromGas(targetTypes);
        return res.status(200).json({
          status: 'success',
          filter: type,
          source: 'gas',
          count: combinedEvents.length,
          data: combinedEvents
        });
      } catch (gasErr) {
        return res.status(500).json({
          status: 'error',
          message: '無法讀取行事曆活動：' + gasErr.message
        });
      }
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

    // ── 寫入與管理操作（POST, PUT, DELETE）：強制身分驗證與校務管理角色校驗 ──
    const auth = await authenticateApiRequest(req);
    if (!auth.valid) {
      return res.status(401).json({ status: 'error', message: auth.error });
    }

    // 查驗調用者角色：僅限系統管理員(0)、校長(1)、主任(2)、組長(3)
    const { data: callerStaff } = await supabase
      .from('staff')
      .select('*')
      .eq('line_uid', auth.uid)
      .maybeSingle();

    if (!callerStaff) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: 查無此教職員身分，拒絕授權' });
    }

    const tags = roleTags(callerStaff);
    const hasCalendarPermission = isSuperAdmin(callerStaff) || ['0', '1', '2', '3'].some(t => tags.includes(t));
    if (!hasCalendarPermission) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: 權限不足，僅限行政主管與管理員操作日曆' });
    }

    // ── 從 Google 日曆單向/雙向拉取最新行程至 Supabase ──
    if (req.method === 'POST' && payload?.action === 'sync_from_gas') {
      let gasEvents;
      try {
        gasEvents = await fetchEventsFromGas(['all', 'wutai', 'ligu']);
      } catch (err) {
        return res.status(502).json({
          status: 'error',
          message: 'Google 日曆同步失敗：' + err.message
        });
      }
      let syncedCount = 0;
      for (const ev of gasEvents) {
        try {
          let { data: existing } = await supabase
            .from('calendar_events')
            .select('id, sync_status')
            .eq('gcal_event_id', ev.id)
            .maybeSingle();

          // 若本地此活動已被標記刪除（failed_delete 或 pending_delete），跳過拉取，避免幽靈活動復活
          if (existing && ['failed_delete', 'pending_delete'].includes(existing.sync_status)) {
            continue;
          }

          // 強化比對：包含 calendar_type，防止跨校區同名同時間活動被誤合併
          if (!existing && ev.title && ev.start) {
            const { data: matchByTime } = await supabase
              .from('calendar_events')
              .select('id, sync_status')
              .eq('title', ev.title)
              .eq('start_time', ev.start)
              .eq('calendar_type', ev.calendarType || 'all')
              .maybeSingle();
            if (matchByTime) {
              if (['failed_delete', 'pending_delete'].includes(matchByTime.sync_status)) {
                continue;
              }
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

      const isPartial = gasEvents.isPartial || (gasEvents.failedTypes && gasEvents.failedTypes.length > 0);
      const successfulCampuses = gasEvents.successfulTypes || [];
      const failedCampuses = gasEvents.failedTypes || [];

      return res.status(200).json({
        status: isPartial ? 'partial' : 'success',
        message: isPartial
          ? `部分校區同步完成：成功同步 ${syncedCount} 筆活動（成功校區：${successfulCampuses.join('、') || '無'}；失敗校區：${failedCampuses.join('、')}）`
          : `成功從 Google 日曆同步 ${syncedCount} 筆活動至 Supabase`,
        syncedCount,
        partial: Boolean(isPartial),
        successfulCampuses,
        failedCampuses
      });
    }

    // ── 刪除活動 (DELETE 或 POST with action: 'delete') ──
    if (req.method === 'DELETE' || (req.method === 'POST' && payload?.action === 'delete')) {
      const { eventId, calendarType } = payload || {};
      if (!eventId) {
        return res.status(400).json({ status: 'error', message: '缺少 eventId' });
      }

      const { data: existing, error: findErr } = await supabase
        .from('calendar_events')
        .select('id, gcal_event_id, calendar_type')
        .or(`id.eq.${eventId},gcal_event_id.eq.${eventId}`)
        .maybeSingle();

      if (findErr) {
        return res.status(500).json({ status: 'error', message: '查詢待刪除活動失敗：' + findErr.message });
      }

      if (!existing) {
        return res.status(404).json({ status: 'error', message: '查無此活動記錄，無法刪除' });
      }

      const gcalId = existing.gcal_event_id;

      // 若有 Google 日曆外部 ID，執行可靠刪除流程（標記 pending_delete -> GAS 刪除 -> 本地 hard delete）
      if (gcalId) {
        // 先標記為 pending_delete 狀態，保留失敗重試與待同步紀錄
        const { error: pendingErr } = await supabase
          .from('calendar_events')
          .update({ sync_status: 'pending_delete', sync_error: null })
          .eq('id', existing.id);

        if (pendingErr) {
          return res.status(500).json({ status: 'error', message: '更新待刪除狀態失敗：' + pendingErr.message });
        }

        const gasResult = await sendGasWriteWithRetry({
          action: 'delete',
          eventId: gcalId,
          calendarType: calendarType || existing.calendar_type || 'all'
        });

        const isGoogleDeleted = gasResult.success || (gasResult.error && (gasResult.error.toLowerCase().includes('not found') || gasResult.error.includes('404')));

        if (isGoogleDeleted) {
          // Google 確認刪除後才完成清理 (Hard Delete)
          const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', existing.id);
          if (delErr) {
            return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
          }
          return res.status(200).json({ status: 'success', message: '活動已刪除' });
        } else {
          // Google 刪除失敗：在資料庫保留失敗紀錄以供補做
          const { error: failErr } = await supabase
            .from('calendar_events')
            .update({
              sync_status: 'failed_delete',
              sync_error: gasResult.error || 'Google 日曆刪除失敗'
            })
            .eq('id', existing.id);

          if (failErr) {
            return res.status(500).json({ status: 'error', message: '儲存待重試刪除紀錄失敗：' + failErr.message });
          }

          return res.status(200).json({
            status: 'success',
            warning: '本地活動已標記刪除，但 Google 日曆同步刪除失敗，已保存待重試紀錄',
            message: '活動已刪除（Google 日曆同步留存失敗佇列）',
            sync_status: 'failed_delete',
            sync_error: gasResult.error
          });
        }
      } else {
        // 若無 Google ID，直接清理資料庫
        const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', existing.id);
        if (delErr) {
          return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
        }
        return res.status(200).json({ status: 'success', message: '活動已刪除' });
      }
    }

    // ── 編輯活動 (PUT 或 POST with action: 'update') ──
    if (req.method === 'PUT' || (req.method === 'POST' && payload?.action === 'update')) {
      const { eventId, calendarType, title, location, description, startTime, endTime, isAllDay } = payload || {};
      if (!eventId || !title || !startTime) {
        return res.status(400).json({ status: 'error', message: '缺少活動 ID (eventId)、名稱 (title) 或開始時間 (startTime)' });
      }

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

      const gcalId = existing.gcal_event_id;
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

      // 背景非同步通知 GAS 更新 Google 日曆事件（具備逾時控制與自動退避重試）
      if (gcalId) {
        sendGasWriteWithRetry({
          action: 'update',
          eventId: gcalId,
          calendarType: calendarType || 'all',
          title: title.trim(),
          location: location ? location.trim() : '',
          description: description ? description.trim() : '',
          startTime,
          endTime: endTime || startTime,
          isAllDay: Boolean(isAllDay)
        }).then(async (gasResult) => {
          if (gasResult.success) {
            const { error: syncUpErr } = await supabase
              .from('calendar_events')
              .update({ sync_status: 'synced', sync_error: null })
              .eq('id', existing.id);
            if (syncUpErr) {
              await supabase.from('calendar_events').update({ updated_at: new Date().toISOString() }).eq('id', existing.id);
            }
          } else {
            await supabase
              .from('calendar_events')
              .update({ sync_status: 'failed', sync_error: gasResult.error || 'Google 日曆更新失敗' })
              .eq('id', existing.id);
          }
        }).catch(err => console.warn('Background GAS update failed:', err.message));
      }

      return res.status(200).json({ status: 'success', message: '活動已更新' });
    }

    // ── 新增活動 (POST) ──
    if (req.method === 'POST') {
      const { 
        calendarType, title, location, description, startTime, endTime, isAllDay,
        periodInfo, targetGrades, department, creatorName, creatorUid, client_event_id
      } = payload || {};

      if (!title || !startTime) {
        return res.status(400).json({ status: 'error', message: '缺少活動名稱 (title) 或開始時間 (startTime)' });
      }

      const clientEventId = client_event_id || req.headers?.['idempotency-key'] || payload?.id;
      const dedupeKey = clientEventId || `${calendarType || 'all'}_${title.trim()}_${startTime}`;

      // 1. 記憶體互斥鎖 (In-Flight Concurrency Mutex)
      if (inFlightCreations.has(dedupeKey)) {
        const result = await inFlightCreations.get(dedupeKey);
        return res.status(result.status).json(result.body);
      }

      const creationPromise = (async () => {
        // 2. 檢查是否已透過相同 client_event_id 寫入資料庫
        if (clientEventId) {
          const { data: existingRow } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', clientEventId)
            .maybeSingle();

          if (existingRow) {
            return {
              status: 200,
              body: { status: 'success', message: '活動已存在（防止重複建立 / 請求冪等保護）', event: existingRow, deduplicated: true }
            };
          }
        }

        // 3. 檢查校區、活動名稱與開始時間是否已存在
        const { data: existingDup } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('calendar_type', calendarType || 'all')
          .eq('title', title.trim())
          .eq('start_time', startTime)
          .maybeSingle();

        if (existingDup) {
          return {
            status: 200,
            body: { status: 'success', message: '活動已存在（防止重複建立）', event: existingDup, deduplicated: true }
          };
        }

        const eventRowId = clientEventId || crypto.randomUUID();
        const { data: newRow, error: insertError } = await supabase
          .from('calendar_events')
          .insert([{
            id: eventRowId,
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
            creator_name: callerStaff?.name || creatorName || '',
            creator_uid: auth.uid,
            sync_status: 'pending_push'
          }])
          .select()
          .single();

        if (insertError) {
          // 捕捉 PostgreSQL 23505 主鍵衝突或唯一鍵衝突（真正併發競爭）
          if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
            const { data: dupRow, error: dupErr } = await supabase
              .from('calendar_events')
              .select('*')
              .or(`id.eq.${eventRowId},and(calendar_type.eq.${calendarType || 'all'},title.eq.${title.trim()},start_time.eq.${startTime})`)
              .maybeSingle();

            if (dupErr || !dupRow) {
              return {
                status: 500,
                body: { status: 'error', message: '併發衝突後檢索既有活動失敗' + (dupErr ? `: ${dupErr.message}` : '') }
              };
            }

            return {
              status: 200,
              body: { status: 'success', message: '活動已存在（防止重複建立 / 併發冪等攔截）', event: dupRow, deduplicated: true }
            };
          }
          console.error('Calendar insert error:', insertError.message);
          return {
            status: 500,
            body: { status: 'error', message: '資料庫寫入活動失敗：' + insertError.message }
          };
        }

        if (!newRow?.id) {
          return {
            status: 500,
            body: { status: 'error', message: '活動新增異常：未能產生有效活動 ID' }
          };
        }

        // 背景非同步發送給 GAS，取得 Google 日曆 Event ID 並更新 sync_status（含退避重試）
        sendGasWriteWithRetry({
          action: 'create',
          calendarType: calendarType || 'all',
          title: title.trim(),
          location: location ? location.trim() : '',
          description: description ? description.trim() : '',
          startTime,
          endTime: endTime || startTime,
          isAllDay: Boolean(isAllDay)
        }).then(async (gasResult) => {
          if (gasResult.success && gasResult.data?.eventId) {
            const gasEventId = gasResult.data.eventId;
            const { error: syncUpdateErr } = await supabase
              .from('calendar_events')
              .update({ gcal_event_id: gasEventId, sync_status: 'synced', sync_error: null })
              .eq('id', eventRowId);

            if (syncUpdateErr) {
              console.warn('Sync status update note:', syncUpdateErr.message);
              // 若正式資料庫尚未執行 migration，降級僅更新 gcal_event_id
              await supabase
                .from('calendar_events')
                .update({ gcal_event_id: gasEventId })
                .eq('id', eventRowId);
            }
            return;
          }

          const failReason = gasResult.error || 'Google Apps Script 回傳失敗';
          const { error: failUpdateErr } = await supabase
            .from('calendar_events')
            .update({
              sync_status: 'failed',
              sync_error: failReason
            })
            .eq('id', eventRowId);

          if (failUpdateErr) {
            console.warn('Failed sync_status update note:', failUpdateErr.message);
          }
        }).catch(async err => {
          console.error('Background GAS create error:', err.message);
        });

        return {
          status: 200,
          body: { status: 'success', message: '活動已成功建立', event: newRow }
        };
      })();

      inFlightCreations.set(dedupeKey, creationPromise);

      try {
        const resObj = await creationPromise;
        return res.status(resObj.status).json(resObj.body);
      } finally {
        inFlightCreations.delete(dedupeKey);
      }
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
