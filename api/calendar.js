const GAS_URL = process.env.CALENDAR_GAS_URL || 'https://script.google.com/macros/s/AKfycbwqB0mHhuLrzUrpe2M7ngW4_97_sQ2VN_MukBetf8sesqG1sJXEX0BIQDxgfOe7L7P3/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ── 讀取活動 (GET) ──
    if (req.method === 'GET') {
      const type = (req.query.type || 'all').toLowerCase();

      // 決定要向 GAS 抓取的日曆清單
      // all: 抓取全校共通、霧臺、勵古三組日曆並合併
      // wutai: 抓取全校共通 + 霧臺
      // ligu: 抓取全校共通 + 勵古
      let targetTypes = ['all', 'wutai', 'ligu'];
      if (type === 'wutai') {
        targetTypes = ['all', 'wutai'];
      } else if (type === 'ligu') {
        targetTypes = ['all', 'ligu'];
      } else if (type === 'only_all') {
        targetTypes = ['all'];
      }

      // 平行向 GAS 抓取各行事曆事件
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
          console.warn(`Fetch calendar type ${t} failed:`, err.message);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      
      // 合併並依 ID 去重
      const eventMap = new Map();
      results.flat().forEach(ev => {
        if (ev && ev.id) {
          eventMap.set(ev.id, ev);
        }
      });

      const combinedEvents = Array.from(eventMap.values());
      // 依開始時間由近到遠排序
      combinedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

      return res.status(200).json({
        status: 'success',
        filter: type,
        count: combinedEvents.length,
        data: combinedEvents
      });
    }

    // ── 新增活動 (POST) ──
    if (req.method === 'POST') {
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          console.error('Body parse error:', e);
        }
      }

      const { calendarType, title, location, description, startTime, endTime, isAllDay } = payload || {};

      if (!title || !startTime) {
        return res.status(400).json({ status: 'error', message: '缺少活動名稱 (title) 或開始時間 (startTime)' });
      }

      // 轉發給 Google Apps Script
      const gasResponse = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarType: calendarType || 'all',
          title: title.trim(),
          location: location ? location.trim() : '',
          description: description ? description.trim() : '',
          startTime,
          endTime: endTime || startTime,
          isAllDay: Boolean(isAllDay)
        })
      });

      if (!gasResponse.ok) {
        const errorText = await gasResponse.text();
        return res.status(gasResponse.status).json({
          status: 'error',
          message: `Google 日曆服務回傳錯誤 (${gasResponse.status}): ${errorText}`
        });
      }

      const gasData = await gasResponse.json();
      return res.status(200).json(gasData);
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
