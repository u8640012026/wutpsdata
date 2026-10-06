-- ==============================================================================
-- 屏東縣霧臺國民小學 校務大腦 (brain_documents) 資料庫建表與唯一約束遷移腳本
-- 目的：建立知識庫資料表、清洗歷史 (dept_id, file_name) 重複文件，並建立資料庫層級唯一索引 (UNIQUE INDEX)
-- 請至 Supabase Dashboard -> SQL Editor 貼上並點擊 Run 執行一次
-- ==============================================================================

-- 0. 若資料表尚未存在，先建立 public.brain_documents 資料表
CREATE TABLE IF NOT EXISTS public.brain_documents (
  id BIGSERIAL PRIMARY KEY,
  dept_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT DEFAULT '未知',
  uploaded_by TEXT DEFAULT '校務同仁',
  uploaded_by_uid TEXT,
  extracted_text TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 啟用 RLS 並設定適當原則
ALTER TABLE public.brain_documents ENABLE ROW LEVEL SECURITY;

-- 允許 Service Role 完全讀寫 (後端 API 使用)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'brain_documents' 
    AND policyname = 'Service role full access on brain_documents'
  ) THEN
    CREATE POLICY "Service role full access on brain_documents" 
    ON public.brain_documents
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;

-- 1. 清理歷史重複資料（依據 dept_id 與 file_name 分組，保留 created_at 最新之一筆，其餘安全刪除）
WITH ranked_docs AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY dept_id, file_name 
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.brain_documents
  WHERE dept_id IS NOT NULL AND file_name IS NOT NULL
)
DELETE FROM public.brain_documents
WHERE id IN (
  SELECT id FROM ranked_docs WHERE rn > 1
);

-- 2. 建立 (dept_id, file_name) 唯一索引（防止未來任何併發重複插入，支援原子 upsert）
CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_documents_dept_filename 
ON public.brain_documents (dept_id, file_name);

-- 3. 補充索引加速處室查詢與倒序瀏覽
CREATE INDEX IF NOT EXISTS idx_brain_documents_dept_created 
ON public.brain_documents (dept_id, created_at DESC);
