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

// 可恢復之待重試工作佇列 (In-Memory Recovery Queue for Failed Sync / Persistence Operations)
export const pendingSyncRecoveries = new Map();

// 統一更新活動輔助函式（具備指數退避重試、錯誤校驗與既有狀態保護）
export async function updateCalendarEventWithRetry(eventId, updateFields, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await supabase
      .from('calendar_events')
      .update(updateFields)
      .eq('id', eventId)
      .select('id, sync_status, calendar_type');

    if (!res.error) {
      return { success: true, data: res.data };
    }
    lastErr = res.error;
    console.error(`[Calendar Sync] Update attempt ${attempt} for event ${eventId} failed:`, res.error.message);
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, attempt * 100));
    }
  }
  return { success: false, error: lastErr };
}

// 統一持久化追蹤紀錄輔助函式（具備主鍵衝突原子 upsert、3次退避重試與失敗保留佇列）
export async function upsertCalendarTrackingWithRetry(trackingRecord, maxAttempts = 3) {
  let lastErr = null;
  const { action, ...dbPayload } = trackingRecord;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await supabase
      .from('calendar_events')
      .upsert([dbPayload], { onConflict: 'id' })
      .select('id, sync_status');

    if (!res.error) {
      if (pendingSyncRecoveries.has(trackingRecord.id)) {
        pendingSyncRecoveries.delete(trackingRecord.id);
      }
      return { success: true, data: res.data };
    }
    lastErr = res.error;
    console.error(`[Calendar Sync] Upsert tracking attempt ${attempt} for event ${trackingRecord.id} failed:`, res.error.message);
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, attempt * 100));
    }
  }

  // 重試耗盡：將工作登記至待恢復佇列，供日後重試與排程清理，確保持久化保證！
  pendingSyncRecoveries.set(trackingRecord.id, {
    ...trackingRecord,
    failedAt: Date.now()
  });

  return { success: false, error: lastErr };
}

// 處理待恢復工作佇列（可由定時器、新請求或測試調用）
export async function processPendingSyncRecoveries() {
  if (pendingSyncRecoveries.size === 0) return { processed: 0, successful: 0 };
  let processed = 0;
  let successful = 0;

  for (const [id, job] of Array.from(pendingSyncRecoveries.entries())) {
    processed++;
    try {
      if (job.action === 'compensating_delete') {
        const gasResult = await sendGasWriteWithRetry({
          action: 'delete',
          eventId: job.gcal_event_id,
          calendarType: job.calendar_type || job.calendarType || 'all'
        });
        const isCompensated = gasResult?.success || (
          gasResult?.error && (
            gasResult.error.toLowerCase().includes('not found') ||
            gasResult.error.includes('404')
          )
        );
        if (isCompensated) {
          await supabase.from('calendar_events').delete().eq('id', id);
          pendingSyncRecoveries.delete(id);
          successful++;
          continue;
        }
      }

      if (job.action === 'sync_gcal_id') {
        const { data: curRow } = await supabase
          .from('calendar_events')
          .select('id, sync_status, calendar_type')
          .eq('id', id)
          .maybeSingle();

        if (curRow && curRow.sync_status === 'pending_delete') {
          const gasResult = await sendGasWriteWithRetry({
            action: 'delete',
            eventId: job.gcal_event_id,
            calendarType: curRow.calendar_type || job.calendar_type || 'all'
          });
          if (gasResult?.success || gasResult?.error?.includes('404')) {
            await supabase.from('calendar_events').delete().eq('id', id);
            pendingSyncRecoveries.delete(id);
            successful++;
            continue;
          }
        } else if (curRow) {
          const { error: upErr } = await supabase
            .from('calendar_events')
            .update({ gcal_event_id: job.gcal_event_id, sync_status: 'synced', sync_error: null })
            .eq('id', id);
          if (!upErr) {
            pendingSyncRecoveries.delete(id);
            successful++;
            continue;
          }
        }
      }

      // 預設或降級：嘗試 upsert 追蹤紀錄
      const trackingRecord = {
        id: job.id,
        gcal_event_id: job.gcal_event_id,
        title: job.title || '[待恢復活動]',
        calendar_type: job.calendar_type || job.calendarType || 'all',
        start_time: job.start_time || job.startTime || new Date().toISOString(),
        end_time: job.end_time || job.endTime || job.start_time || job.startTime || new Date().toISOString(),
        sync_status: job.sync_status || 'failed_delete',
        sync_error: job.sync_error || '從待恢復佇列重新持久化'
      };

      const { error: upsertErr } = await supabase
        .from('calendar_events')
        .upsert([trackingRecord], { onConflict: 'id' });

      if (!upsertErr) {
        pendingSyncRecoveries.delete(id);
        successful++;
      }
    } catch (e) {
      console.error(`[Calendar Recovery] Failed to recover job ${id}:`, e.message);
    }
  }

  return { processed, successful };
}

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
    if (pendingSyncRecoveries.size > 0) {
      processPendingSyncRecoveries().catch(e => console.warn('[Calendar Recovery] Background process note:', e.message));
    }

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
        .select('id, gcal_event_id, calendar_type, sync_status')
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
        // 若無 Google ID：
        // 關鍵競態防護：如果 sync_status === 'pending_push'，代表後台正向 Google 發送新增請求！
        // 若直接 hard delete 本地資料，Google 建立成功後將變成無主孤兒活動，日後 sync_from_gas 會再度復活！
        if (existing.sync_status === 'pending_push') {
          // 關鍵修復（反向交錯競態防護）：
          // 使用帶條件的原子更新：僅當 sync_status 仍然是 pending_push 時才標記為 pending_delete
          const { data: updatedPending, error: markErr } = await supabase
            .from('calendar_events')
            .update({ sync_status: 'pending_delete', sync_error: '使用者於 Google 建立期間請求刪除' })
            .eq('id', existing.id)
            .eq('sync_status', 'pending_push')
            .select('id, sync_status, gcal_event_id, calendar_type');

          if (markErr) {
            return res.status(500).json({ status: 'error', message: '標記待刪除狀態失敗：' + markErr.message });
          }

          const isUpdatedPending = (Array.isArray(updatedPending) && updatedPending.length > 0) || Boolean(updatedPending && !updatedPending.error && updatedPending.id);
          if (isUpdatedPending) {
            // 條件更新成功：代表背景工作尚未寫回，當背景工作隨後執行 .eq('sync_status', 'pending_push') 條件更新時必將匹配 0 列，並自動觸發補償性 Google 刪除
            return res.status(200).json({
              status: 'success',
              message: '活動正在 Google 建立中，已標記待刪除狀態，建立完成後將自動補償性自 Google 移除',
              sync_status: 'pending_delete'
            });
          }

          // 條件更新匹配 0 列：代表背景工作在剛才那一瞬間已經寫回完成（狀態已非 pending_push，且極可能已帶有 gcal_event_id）！
          // 重新檢索該活動最新資料，不能直接宣告等待背景補償！
          const { data: refreshedRow, error: refreshErr } = await supabase
            .from('calendar_events')
            .select('id, gcal_event_id, calendar_type, sync_status')
            .eq('id', existing.id)
            .maybeSingle();

          if (refreshErr) {
            return res.status(500).json({ status: 'error', message: '重新檢查活動狀態失敗：' + refreshErr.message });
          }

          if (!refreshedRow) {
            return res.status(200).json({ status: 'success', message: '活動已刪除' });
          }

          // 若背景工作剛好已寫入 Google ID：立即直接執行可靠的 Google 刪除流程！
          if (refreshedRow.gcal_event_id) {
            const { error: pendingErr } = await supabase
              .from('calendar_events')
              .update({ sync_status: 'pending_delete', sync_error: null })
              .eq('id', refreshedRow.id);

            if (pendingErr) {
              return res.status(500).json({ status: 'error', message: '更新待刪除狀態失敗：' + pendingErr.message });
            }

            const gasResult = await sendGasWriteWithRetry({
              action: 'delete',
              eventId: refreshedRow.gcal_event_id,
              calendarType: calendarType || refreshedRow.calendar_type || 'all'
            });

            const isGoogleDeleted = gasResult.success || (gasResult.error && (gasResult.error.toLowerCase().includes('not found') || gasResult.error.includes('404')));

            if (isGoogleDeleted) {
              const { error: delErr } = await supabase.from('calendar_events').delete().eq('id', refreshedRow.id);
              if (delErr) {
                return res.status(500).json({ status: 'error', message: '資料庫刪除活動失敗：' + delErr.message });
              }
              return res.status(200).json({ status: 'success', message: '活動已刪除' });
            } else {
              const { error: failErr } = await supabase
                .from('calendar_events')
                .update({
                  sync_status: 'failed_delete',
                  sync_error: gasResult.error || 'Google 日曆刪除失敗'
                })
                .eq('id', refreshedRow.id);

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
          }
        }

        // 純本地活動（非 pending_push 且無 Google ID）：直接清理資料庫
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

            // 關鍵競態防護 (1)：原子條件更新，僅當仍為 pending_push 時才寫入 synced
            // 若使用者在此期間已發出 DELETE（狀態已轉為 pending_delete），此條件更新將匹配 0 列，杜絕覆蓋刪除意圖！
            const { data: updatedRows, error: syncUpdateErr } = await supabase
              .from('calendar_events')
              .update({ gcal_event_id: gasEventId, sync_status: 'synced', sync_error: null })
              .eq('id', eventRowId)
              .eq('sync_status', 'pending_push')
              .select('id, sync_status, calendar_type');

            if (syncUpdateErr) {
              console.warn('Sync status conditional update note:', syncUpdateErr.message);
            }

            // 若成功更新 1 列，代表建立期間無併發刪除，安全完成
            const isUpdatedSynced = (Array.isArray(updatedRows) && updatedRows.length > 0) || Boolean(updatedRows && !updatedRows.error && updatedRows.id);
            if (isUpdatedSynced) {
              return;
            }

            // 關鍵防護 (2)：若未匹配到列，安全重試查詢最新狀態，嚴格區分「查詢異常」與「確定查無/待刪除」！
            let latestRow = null;
            let queryLatestErr = null;
            for (let qAttempt = 1; qAttempt <= 3; qAttempt++) {
              const res = await supabase
                .from('calendar_events')
                .select('id, sync_status, calendar_type')
                .eq('id', eventRowId)
                .maybeSingle();
              latestRow = res.data;
              queryLatestErr = res.error;
              if (!queryLatestErr) break;
              await new Promise(r => setTimeout(r, qAttempt * 100));
            }

            // 致命缺陷防護：資料庫查詢失敗時，嚴禁覆蓋既有刪除意圖（如 pending_delete）！
            // 使用帶重試的 updateCalendarEventWithRetry 僅更新 gcal_event_id 與 sync_error，保留資料庫既有狀態
            if (queryLatestErr) {
              console.error('[Calendar Sync] Query latest row error after GAS create. Preserving Google ID without deleting:', queryLatestErr.message);

              const updateRes = await updateCalendarEventWithRetry(eventRowId, {
                gcal_event_id: gasEventId,
                sync_error: 'Google 已建立，但確認狀態時資料庫查詢異常：' + queryLatestErr.message
              });

              if (!updateRes.success) {
                // 若多次重試仍失敗，登記至待恢復佇列，確保持久化保證
                pendingSyncRecoveries.set(eventRowId, {
                  id: eventRowId,
                  gcal_event_id: gasEventId,
                  title: title.trim(),
                  calendar_type: calendarType || 'all',
                  start_time: startTime,
                  end_time: endTime || startTime,
                  action: 'sync_gcal_id',
                  sync_status: 'pending_push',
                  sync_error: '更新 Google ID 失敗，待恢復佇列保留：' + updateRes.error?.message,
                  failedAt: Date.now()
                });
                return;
              }

              // 檢查更新後列之狀態（不覆蓋刪除意圖！）
              const updatedRow = (Array.isArray(updateRes.data) && updateRes.data.length > 0)
                ? updateRes.data[0]
                : updateRes.data;

              if (updatedRow && updatedRow.sync_status === 'pending_delete') {
                // 資料庫既有狀態確定為 pending_delete！代表使用者已請求刪除，接續補償性刪除
                console.log(`[Calendar Sync] Event ${eventRowId} had pending_delete during query error recovery. Initiating compensating delete.`);
                latestRow = updatedRow;
              } else if (!updatedRow) {
                // 原紀錄已不存在（已被刪除），接續補償性刪除
                latestRow = null;
              } else {
                // 原紀錄為非刪除狀態（如 pending_push），Google ID 已安全保存且未誤刪
                return;
              }
            }

            // 僅當確定「紀錄不存在（已被硬刪除）」或「已標記為 pending_delete」時，才執行補償性 Google 刪除
            if (!latestRow || latestRow.sync_status === 'pending_delete') {
              console.log(`[Calendar Sync] Event ${eventRowId} confirmed deleted or pending_delete. Initiating compensating delete for ${gasEventId}`);
              
              // 先在本地妥善保存 gcal_event_id，防止追蹤資訊丟失
              if (latestRow) {
                await updateCalendarEventWithRetry(eventRowId, {
                  gcal_event_id: gasEventId,
                  sync_status: 'pending_delete'
                });
              }

              const compGasResult = await sendGasWriteWithRetry({
                action: 'delete',
                eventId: gasEventId,
                calendarType: calendarType || latestRow?.calendar_type || 'all'
              });

              const isCompensated = compGasResult?.success || (
                compGasResult?.error && (
                  compGasResult.error.toLowerCase().includes('not found') ||
                  compGasResult.error.includes('404')
                )
              );

              if (isCompensated) {
                // Google 日曆已確認刪除，執行本地硬刪除並嚴格校驗資料庫錯誤
                const { error: hardDelErr } = await supabase.from('calendar_events').delete().eq('id', eventRowId);
                if (hardDelErr) {
                  console.error('[Calendar Sync] Failed to hard delete event after compensating GAS delete:', hardDelErr.message);
                  const failTracking = {
                    id: eventRowId,
                    gcal_event_id: gasEventId,
                    title: title.trim(),
                    calendar_type: calendarType || latestRow?.calendar_type || 'all',
                    start_time: startTime,
                    end_time: endTime || startTime,
                    sync_status: 'failed_delete',
                    sync_error: 'Google 已刪除，但本地清理失敗：' + hardDelErr.message
                  };
                  await upsertCalendarTrackingWithRetry(failTracking);
                }
              } else {
                // 補償刪除失敗（如 permission denied 或 quota exceeded）：嚴禁硬刪除本地！
                // 使用統一的 upsertCalendarTrackingWithRetry，杜絕 23505 衝突並提供 3 次重試與恢復佇列保證
                console.error('[Calendar Sync] Compensating GAS delete failed, persisting failed_delete tracking record:', compGasResult?.error);
                
                const trackingRecord = {
                  id: eventRowId,
                  gcal_event_id: gasEventId,
                  title: latestRow ? title.trim() : ('[孤兒活動待刪除] ' + (title || '').trim()),
                  calendar_type: calendarType || latestRow?.calendar_type || 'all',
                  start_time: startTime || new Date().toISOString(),
                  end_time: endTime || startTime || new Date().toISOString(),
                  sync_status: 'failed_delete',
                  sync_error: compGasResult?.error || '補償性 Google 日曆刪除失敗',
                  action: 'compensating_delete'
                };

                await upsertCalendarTrackingWithRetry(trackingRecord);
              }
              return;
            }

            return;
          }

          const failReason = gasResult.error || 'Google Apps Script 回傳失敗';
          // 若建立失敗且已被標記 pending_delete，直接刪除該筆失敗紀錄
          const { data: latestRowOnFail } = await supabase
            .from('calendar_events')
            .select('id, sync_status')
            .eq('id', eventRowId)
            .maybeSingle();

          if (!latestRowOnFail || latestRowOnFail.sync_status === 'pending_delete') {
            await supabase.from('calendar_events').delete().eq('id', eventRowId);
            return;
          }

          const { error: failUpdateErr } = await supabase
            .from('calendar_events')
            .update({
              sync_status: 'failed',
              sync_error: failReason
            })
            .eq('id', eventRowId)
            .eq('sync_status', 'pending_push');

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
