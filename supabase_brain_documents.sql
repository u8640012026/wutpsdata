-- ==============================================================================
-- 屏東縣霧臺國民小學 校務大腦 (brain_documents) 資料庫去重與唯一約束遷移腳本
-- 目的：清洗歷史 (dept_id, file_name) 重複文件，並建立資料庫層級唯一索引 (UNIQUE INDEX)
-- 請至 Supabase Dashboard -> SQL Editor 貼上並點擊 Run 執行一次
-- ==============================================================================

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
