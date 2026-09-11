import { createClient } from '@supabase/supabase-js';
import { roleTags, isSuperAdmin } from '../src/lib/staffAccess.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: '伺服器未設定機密金鑰 (SERVICE_ROLE_KEY)' });
  }

  try {
    if (req.method === 'GET') {
      const { archived, id } = req.query;

      // 支援單一公告查詢 (供公開分享連結免登入查閱)
      if (id) {
        const { data, error } = await supabase
          .from('announcements')
          .select('id, title, content, author_name, expire_at, attachments, is_archived, created_at')
          .eq('id', id)
          .single();
        if (error || !data) {
          return res.status(404).json({ error: '查無此公告或已被刪除。' });
        }
        const safeAnnouncement = {
          id: data.id,
          title: data.title,
          content: data.content,
          author_name: data.author_name,
          expire_at: data.expire_at,
          attachments: data.attachments || [],
          is_archived: data.is_archived,
          created_at: data.created_at
        };
        return res.status(200).json(safeAnnouncement);
      }

      const isArchived = archived === 'true';
      
      // 自動檢查並將過期公告下架 (只有在查詢活動公告時執行)
      if (!isArchived) {
        await supabase
          .from('announcements')
          .update({ is_archived: true })
          .lt('expire_at', new Date().toISOString())
          .eq('is_archived', false);
      }
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_archived', isArchived)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    
    const uid = req.headers?.['x-line-uid'];
    if (!uid) return res.status(401).json({ error: '請先登入。' });
    const { data: staff } = await supabase.from('staff').select('*').eq('line_uid', uid).single();
    if (!staff || !(isSuperAdmin(staff) || ['1','2','3'].some(tag => roleTags(staff).includes(tag)))) return res.status(403).json({ error: '沒有公告維護權限。' });

    if (req.method === 'POST') {
      const { title, content, expire_at, attachments } = req.body;
      
      const { data, error } = await supabase
        .from('announcements')
        .insert([{ 
          title, content, author_uid: uid, author_name: staff.name,
          expire_at: expire_at || null, 
          attachments: attachments || [] 
        }])
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    if (req.method === 'PUT') {
      const { id, is_archived, title, content, expire_at, attachments } = req.body;
      const { data: existing } = await supabase.from('announcements').select('*').eq('id', id).single();
      if (!existing) return res.status(404).json({ error: '公告不存在。' });
      if (!isSuperAdmin(staff) && existing.author_uid !== uid) return res.status(403).json({ error: '只能編修自己的公告。' });
      const updates = {};
      if (typeof is_archived === 'boolean') updates.is_archived = is_archived;
      if (typeof title === 'string') updates.title = title.trim();
      if (typeof content === 'string') updates.content = content;
      if (expire_at !== undefined) updates.expire_at = expire_at;
      if (Array.isArray(attachments)) updates.attachments = attachments;
      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select();
        
      if (error) throw error;
      return res.status(200).json(data[0]);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
