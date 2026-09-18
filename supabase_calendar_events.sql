-- ==============================================================================
-- 屏東縣霧臺國民小學 校務行事曆 (calendar_events) 資料表結構與權限設定
-- 請至 Supabase Dashboard -> SQL Editor 貼上並點擊 Run 執行
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gcal_event_id TEXT, -- 對應 Google 日曆 Event ID，供日後雙向同步與刪除/更新精確對應
    calendar_type TEXT NOT NULL CHECK (calendar_type IN ('all', 'wutai', 'ligu')),
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    period_info TEXT DEFAULT '', -- 如 '早自習 至 第 1 節'
    target_grades TEXT DEFAULT '全校所有班級', -- 對象班級
    department TEXT DEFAULT '教務處', -- 承辦處室
    description TEXT DEFAULT '', -- 完整備註說明
    creator_name TEXT DEFAULT '',
    creator_uid TEXT DEFAULT '',
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'pending_push', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_calendar_events_type_time ON public.calendar_events (calendar_type, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_gcal_id ON public.calendar_events (gcal_event_id);

-- 啟用 Row-Level Security (RLS)
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- 政策 1：允許所有人讀取（校務行事曆為公開資訊）
DROP POLICY IF EXISTS "Allow public read calendar_events" ON public.calendar_events;
CREATE POLICY "Allow public read calendar_events" 
ON public.calendar_events 
FOR SELECT 
USING (true);

-- 政策 2：允許 Service Role 完全管理（後端 API 經過身份校驗後寫入、更新與刪除）
DROP POLICY IF EXISTS "Allow service role all calendar_events" ON public.calendar_events;
CREATE POLICY "Allow service role all calendar_events" 
ON public.calendar_events 
FOR ALL 
TO service_role 
USING (true);

-- 政策 3：收緊安全防護，嚴禁 anon 直接進行寫入、更新與刪除（必須由後端 API 執行）
DROP POLICY IF EXISTS "Allow anon write calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow anon update calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "Allow anon delete calendar_events" ON public.calendar_events;

