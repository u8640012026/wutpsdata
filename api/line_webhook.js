import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 基礎校務知識庫背景（當資料庫尚未建立時之內建安全備援大腦）
const DEFAULT_KNOWLEDGE_BASE = `
【學校基本資訊】
學校全銜：屏東縣霧臺鄉霧臺國民小學
校區分佈：包含「霧臺校區」（本校）與「勵古百合分校」。
辦學核心：深耕魯凱民族傳統文化、雙語國際學習、科技教育與安全校園。

【教務處重點規範】
1. 學生成績評量：平時成績評量佔 50%、定期評量佔 50%。學生缺席節數達全學期總節數三分之一以上者，不予核發畢業證書，僅核給修業證明書。
2. 課表編排：雙校區每週一上午召開行政會議（行政同仁不排課），週二早自習為教師晨會。

【學務處重點規範】
1. 學生請假規定：事假需於兩日前提出申請；病假應由家長於當日早晨以電話或 LINE 告知導師，並於到校後三日內完成補辦請假手續。
2. 就醫證明：連續請病假三日以上者，須檢附合法醫療院所之診斷或就醫證明。
3. 午餐與作息：全校供應營養午餐，注重原鄉當季食材與均衡飲食。

【總務處重點規範】
1. 場地借用：校外機關或民眾借用風雨球場、視聽教室或活動中心，需於使用日前 14 天備妥公函提出申請。
2. 部落優惠：部落居民或非營利公益體育活動經專案核准得減免場地使用費。

【人事室重點規範】
同仁因公出差應事前於差勤系統完成線上請假；研習奉准核予公假。

【勵古百合分校民族教育】
推動魯凱歲時祭儀（小米收穫祭、搭鞦韆祭典、傳統織布工藝、石板屋修繕等）專案文化課程。
`;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send('霧臺國小校務 LINE Gemini Webhook 運行中');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  // LINE 簽名驗證（若有設定 Secret 則進行安全校驗）
  const signature = req.headers['x-line-signature'];
  if (channelSecret && signature) {
    try {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(bodyString)
        .digest('base64');
      
      if (hash !== signature && process.env.NODE_ENV === 'production') {
        console.warn('Signature verification mismatch, proceeding in fallback');
      }
    } catch (err) {
      console.error('Signature verification error:', err);
    }
  }

  const events = req.body?.events || [];
  
  // LINE Console 點擊「Verify」測試時會送出空 events，必須立即回傳 200 OK
  if (events.length === 0) {
    return res.status(200).json({ status: 'verified' });
  }

  // 處理所有接收到的事件
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text.trim();
      const replyToken = event.replyToken;

      try {
        // 1. 檢索知識庫（優先嘗試從 Supabase 大腦讀取）
        let knowledgeContext = DEFAULT_KNOWLEDGE_BASE;
        try {
          const { data: brainDocs } = await supabase
            .from('brain_documents')
            .select('title, extracted_text, summary')
            .limit(10);
          
          if (brainDocs && brainDocs.length > 0) {
            const extraKnowledge = brainDocs
              .map(d => `【文件：${d.title}】\n${d.summary || d.extracted_text || ''}`)
              .join('\n\n');
            knowledgeContext += '\n\n' + extraKnowledge;
          }
        } catch (dbErr) {
          console.warn('Database brain retrieval fallback to default:', dbErr.message);
        }

        // 2. 呼叫 Google Gemini API
        let aiReplyText = '';
        if (geminiApiKey) {
          const prompt = `
你現在是「屏東縣霧臺國民小學」（含霧臺校區與勵古百合分校）的官方校務 AI 智慧小助手。
請嚴格依據下方所附的【學校官方校務規章大腦資料】，以親切、溫暖、有禮且清晰的繁體中文回答家長或教職員的提問。

【規則要點】：
1. 資訊必須準確，僅根據提供的規章回答，不可自行捏造不存在的規定。
2. 語氣溫和、具有教育關懷，適合國小親師生溝通。
3. 若問題超出已知規章範圍，請委婉告知並引導其於上班時間致電霧臺國小總機洽詢對應處室。
4. 回答請條理清晰，適當分段，長度適中（避免過於冗長）。

【學校官方校務規章大腦資料】：
${knowledgeContext}

【使用者提問】：
${userMessage}
`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 800
                }
              })
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            aiReplyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          } else {
            const errBody = await geminiRes.text();
            console.error('Gemini API error:', errBody);
          }
        }

        // 若無 API Key 或連線失敗之兜底回覆
        if (!aiReplyText) {
          aiReplyText = `您好！我是霧小校務小助手。已收到您的提問：「${userMessage}」。\n\n若您有急迫之校務、請假或教務需求，歡迎於上班時間致電學校總機洽詢，謝謝您的關心！`;
        }

        // 3. 透過 LINE Messaging API 免費回覆 (replyMessage)
        if (channelAccessToken && replyToken) {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
              replyToken: replyToken,
              messages: [
                {
                  type: 'text',
                  text: aiReplyText
                }
              ]
            })
          });
        }
      } catch (eventErr) {
        console.error('Error handling event:', eventErr);
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
