import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://kxedexdzlnyqkeemepyu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 基礎校務知識庫背景（包含全校最新官方教師授課總課表與處室規章）
const DEFAULT_KNOWLEDGE_BASE = `
【學校基本資訊】
學校全銜：屏東縣霧臺鄉霧臺國民小學
校區分佈：包含「霧臺校區」（本校）與「勵古百合分校」。
辦學核心：深耕魯凱民族傳統文化、雙語國際學習、科技教育與安全校園。

【115學年度 全校教師授課總課表（官方正式課表）】

《霧臺校區 班級導師名單》
- 一甲：夢藍 老師
- 二甲：曉妍 老師
- 三甲：恒毅 老師
- 四甲：金璋 老師
- 五甲：皓宇 老師
- 六甲：欣蒔 老師

《霧臺校區 星期一 各班課表》
- 一甲：第1節 山活、第2節 國語、第3節 數學、第4節 魯美、第5節 山活、第6節 自然、第7節 自然
- 二甲：第1節 魯美、第2節 國語、第3節 山活、第4節 數學、第5節 健體、第6節 魯美、第7節 山活
- 三甲：第1節 國語、第2節 魯美、第3節 族語、第4節 族語、第5節 魯美、第6節 山活、第7節 自學
- 四甲：第1節 族語、第2節 族語、第3節 國語、第4節 數學、第5節 族語、第6節 族語、第7節 英語
- 五甲：第1節 國語、第2節 國語、第3節 數學、第4節 數學、第5節 健體、第6節 自然、第7節 社會（導師：皓宇老師。早上第1至第4節，皆由皓宇老師授課，包含2節國語與2節數學）
- 六甲：第1節 國語、第2節 山活、第3節 魯美、第4節 探究、第5節 健體、第6節 族語、第7節 自學

《霧臺校區 星期二 各班課表》
- 一甲：第1節 數學、第2節 文讀、第3節 國語、第4節 國語、第5節 族語、第6節 族語、第7節 國語
- 二甲：第1節 國語、第2節 樂舞、第3節 族語、第4節 族語、第5節 探究、第6節 數學、第7節 社會
- 三甲：第1節 數學、第2節 數學、第3節 百合、第4節 民自、第5節 社會、第6節 國語、第7節 健體
- 四甲：第1節 自然、第2節 自然、第3節 國語、第4節 國語、第5節 數學、第6節 生美、第7節 生美
- 五甲：第1節 族語、第2節 族語、第3節 民自、第4節 數學、第5節 國語、第6節 社會、第7節 健體
- 六甲：第1節 樂舞、第2節 國語、第3節 國語、第4節 百合、第5節 數學、第6節 數學、第7節 生美

《霧臺校區 星期三 各班課表》
- 一甲：第1節 國語、第2節 數學、第3節 生美、第4節 樂舞
- 二甲：第1節 數學、第2節 生美、第3節 國語、第4節 國語
- 三甲：第1節 樂舞、第2節 國語、第3節 數學、第4節 健體
- 四甲：第1節 國語、第2節 數學、第3節 樂舞、第4節 健體
- 五甲：第1節 數學、第2節 樂舞、第3節 英語、第4節 社會
- 六甲：第1節 自然、第2節 自然、第3節 數學、第4節 健體

《霧臺校區 星期四 各班課表》
- 一甲：第1節 健體、第2節 數學、第3節 民自、第4節 國語、第5節 全校活動、第6節 生活、第7節 國語
- 二甲：第1節 國語、第2節 民自、第3節 健體、第4節 民數、第5節 全校活動、第6節 生活、第7節 數學
- 三甲：第1節 數學、第2節 數學、第3節 英語、第4節 社會、第5節 全校活動、第6節 國語、第7節 生美
- 四甲：第1節 自學、第2節 國語、第3節 民自、第4節 英語、第5節 全校活動、第6節 社會、第7節 社會
- 五甲：第1節 自然、第2節 自然、第3節 國語、第4節 數學、第5節 全校活動、第6節 文讀、第7節 社會
- 六甲：第1節 國語、第2節 國語、第3節 數學、第4節 數學、第5節 全校活動、第6節 英語、第7節 英語

《霧臺校區 星期五 各班課表》
- 一甲：第1節 國語、第2節 民數、第3節 百合、第4節 探究
- 二甲：第1節 百合、第2節 國語、第3節 數學、第4節 文讀
- 三甲：第1節 自學、第2節 生美、第3節 文讀、第4節 民數、第5節 探究、第6節 健體
- 四甲：第1節 數學、第2節 探究、第3節 民數、第4節 百合、第5節 國語、第6節 文讀、第7節 探究
- 五甲：第1節 國語、第2節 百合、第3節 國語、第4節 民數、第5節 英語、第6節 健體、第7節 健體
- 六甲：第1節 民自、第2節 國語、第3節 社會、第4節 自學、第5節 文讀、第6節 民數

---

《勵古百合分校 班級導師名單》
- 一乙：美惠 老師
- 二乙：惠珍 老師
- 三乙：桂芬 老師
- 四乙：沛辰 老師
- 五乙：家駿 老師
- 六乙：以謙 老師

《勵古百合分校 星期一 各班課表》
- 一乙：第1節 國語、第2節 生美、第3節 山活、第4節 民自
- 二乙：第1節 國語、第2節 山活、第3節 生美、第4節 數學
- 三乙：第1節 數學、第2節 民數、第3節 國語、第4節 山活、第5節 百合、第6節 民自、第7節 健體
- 四乙：第1節 數學、第2節 數學、第3節 自然、第4節 自然、第5節 國語、第6節 百合、第7節 文讀
- 五乙：第1節 國語、第2節 國語、第3節 數學、第4節 民數、第5節 探究、第6節 英語、第7節 百合
- 六乙：第1節 國語、第2節 文讀、第3節 數學、第4節 社會、第5節 探究、第6節 自然、第7節 自然

《勵古百合分校 星期二 各班課表》
- 一乙：第1節 國語、第2節 國語、第3節 數學、第4節 民數、第5節 全校活動、第6節 健體
- 二乙：第1節 國語、第2節 探究、第3節 民自、第4節 民數、第5節 全校活動、第6節 文讀、第7節 生美
- 三乙：第1節 國語、第2節 國語、第3節 英語、第4節 文讀、第5節 全校活動、第6節 探究、第7節 民數
- 四乙：第1節 健體、第2節 國語、第3節 國語、第4節 英語、第5節 全校活動、第6節 數學、第7節 健體
- 五乙：第1節 自然、第2節 自然、第3節 國語、第4節 數學、第5節 全校活動、第6節 生美、第7節 國語
- 六乙：第1節 英語、第2節 自學、第3節 數學、第4節 健體、第5節 全校活動、第6節 國語

《勵古百合分校 星期三 各班課表》
- 一乙：第1節 數學、第2節 數學、第3節 文讀、第4節 生活
- 二乙：第1節 族語、第2節 族語、第3節 健體、第4節 國語
- 三乙：第1節 國語、第2節 健體、第3節 數學、第4節 數學
- 四乙：第1節 健體、第2節 國語、第3節 數學、第4節 民自
- 五乙：第1節 民自、第2節 英語、第3節 國語、第4節 數學
- 六乙：第1節 國語、第2節 民自、第3節 數學、第4節 生美

《勵古百合分校 星期四 各班課表》
- 一乙：第1節 數學、第2節 百合、第3節 國語、第4節 國語、第5節 族語、第6節 族語
- 二乙：第1節 國語、第2節 國語、第3節 百合、第4節 生活、第5節 數學、第6節 樂舞、第7節 數學
- 三乙：第1節 自然、第2節 自然、第3節 自學、第4節 國語、第5節 社會、第6節 數學、第7節 山活
- 四乙：第1節 生美、第2節 國語、第3節 探究、第4節 社會、第5節 樂舞、第6節 自學、第7節 樂舞
- 五乙：第1節 社會、第2節 國語、第3節 族語、第4節 族語、第5節 數學、第6節 山活、第7節 社會
- 六乙：第1節 族語、第2節 族語、第3節 數學、第4節 百合、第5節 山活、第6節 國語

《勵古百合分校 星期五 各班課表》
- 一乙：第1節 樂舞、第2節 國語、第3節 探究、第4節 魯美
- 二乙：第1節 國語、第2節 魯美、第3節 數學、第4節 數學
- 三乙：第1節 魯美、第2節 樂舞、第3節 族語、第4節 族語、第5節 國語、第6節 社會
- 四乙：第1節 族語、第2節 族語、第3節 魯美、第4節 國語、第5節 社會、第6節 數學
- 五乙：第1節 健體、第2節 國語、第3節 修正、第4節 自學、第5節 魯美、第6節 數學、第7節 社會
- 六乙：第1節 國語、第2節 健體、第3節 樂舞、第4節 數學、第5節 民數、第6節 魯美、第7節 英語

《全校課表重要排課附註》
(1) 週一上午：行政會議，行政人員不排課
(2) 週二：早自習教師晨會，教務主任週二樂齡計畫不排課
(3) 週四：總務主任研習不排課
(4) 週五下午：研發小組會議不排課
(5) 族語、耆老課程固定時段不得變更
(6) 總務主任兩校區排課

【教務處重點規範】
1. 學生成績評量：平時成績評量佔 50%、定期評量佔 50%。學生缺席節數達全學期總節數三分之一以上者，不予核發畢業證書，僅核給修業證明書。

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

// 核心呼叫 Google Gemini
async function callGemini(prompt, geminiApiKey) {
  if (!geminiApiKey) {
    return { success: false, error: 'GEMINI_API_KEY 未設定' };
  }

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview'
  ];

  const errors = {};
  for (const model of candidateModels) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2000
            }
          })
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        const text = parts.map(p => p.text || '').join('').trim();
        if (text) {
          return { success: true, reply: text, model: `Gemini (${model})` };
        }
        errors[model] = 'empty reply text';
      } else {
        const errBody = await geminiRes.text();
        errors[model] = `${geminiRes.status}: ${errBody.slice(0, 150)}`;
      }
    } catch (fetchErr) {
      errors[model] = `fetch_error: ${fetchErr.message}`;
    }
  }

  return { success: false, errors };
}

// 核心呼叫 Groq Cloud (Llama 3.3 70B / Llama 3.1 8B 秒級備援)
async function callGroq(systemPrompt, userMessage, groqApiKey) {
  if (!groqApiKey) {
    return { success: false, error: 'GROQ_API_KEY 未設定' };
  }

  const candidateModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  const errors = {};
  for (const model of candidateModels) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 2000
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content?.trim() || '';
        if (text) {
          return { success: true, reply: text, model: `Groq (${model})` };
        }
        errors[model] = 'empty reply text';
      } else {
        const errBody = await groqRes.text();
        errors[model] = `${groqRes.status}: ${errBody.slice(0, 150)}`;
      }
    } catch (fetchErr) {
      errors[model] = `fetch_error: ${fetchErr.message}`;
    }
  }

  return { success: false, errors };
}

// 雙引擎調度管線：Google Gemini 主力 + Groq 秒級無縫備援
async function askSchoolAI(userMessage, { geminiApiKey, groqApiKey, forceEngine } = {}) {
  // 1. 檢索知識庫（預設官方課表規章 + Supabase 自訂上傳檔案）
  let knowledgeContext = DEFAULT_KNOWLEDGE_BASE;
  try {
    const { data: brainDocs } = await supabase
      .from('brain_documents')
      .select('title, extracted_text, summary')
      .limit(10);
    
    if (brainDocs && brainDocs.length > 0) {
      const extraKnowledge = brainDocs
        .map(d => `【自訂上傳文件：${d.title}】\n${d.summary || d.extracted_text || ''}`)
        .join('\n\n');
      knowledgeContext += '\n\n' + extraKnowledge;
    }
  } catch (dbErr) {
    console.warn('DB query note:', dbErr.message);
  }

  const systemInstructions = `你現在是「屏東縣霧臺國民小學」（含霧臺校區與勵古百合分校）的官方校務 AI 智慧小助手。
請嚴格依據下方所附的【學校官方校務規章與教師授課總課表資料】，以親切、溫暖、有禮且條理分明的繁體中文回答提問。

【回答守則】：
1. 詢問課表或課程時：
   - 務必依據官方課表詳細列出「節次」與「科目名稱」（例如：第 1 節：國語、第 2 節：國語、第 3 節：數學、第 4 節：數學）。
   - 請主動說明該班導師姓名（例如：五甲導師為皓宇老師；五乙導師為家駿老師）。
   - 說明早上（第 1 至第 4 節）與下午之區隔。
2. 資訊必須嚴謹準確，切勿自行編造不存在的課程或規定。
3. 若問題超出已知規章或課表範圍，請委婉告知並引導其於上班時間致電霧臺國小洽詢對應處室。

【學校官方校務規章與教師授課總課表資料】：
${knowledgeContext}`;

  const geminiPrompt = `
${systemInstructions}

【使用者提問】：
${userMessage}
`;

  // 若指定強制使用 Groq（如測試端點 ?engine=groq）
  if (forceEngine === 'groq') {
    const groqRes = await callGroq(systemInstructions, userMessage, groqApiKey);
    if (groqRes.success) {
      return { reply: groqRes.reply, usedModel: groqRes.model, provider: 'Groq Cloud (指定)', error: '' };
    }
    return { reply: '', usedModel: '', provider: 'Groq Cloud', error: JSON.stringify(groqRes.errors || groqRes.error) };
  }

  // 第一主力：嘗試 Google Gemini
  if (geminiApiKey) {
    const geminiRes = await callGemini(geminiPrompt, geminiApiKey);
    if (geminiRes.success) {
      return { reply: geminiRes.reply, usedModel: geminiRes.model, provider: 'Google Gemini (主力)', error: '' };
    }
    console.warn('Google Gemini 引擎暫時不可用，秒級啟動 Groq 備援：', geminiRes.errors);
  }

  // 第二備援：無縫切換至 Groq (Llama 3.3 70B)
  if (groqApiKey) {
    const groqRes = await callGroq(systemInstructions, userMessage, groqApiKey);
    if (groqRes.success) {
      return { reply: groqRes.reply, usedModel: groqRes.model, provider: 'Groq Cloud (自動備援)', error: '' };
    }
    console.error('Groq 備援引擎亦回報錯誤：', groqRes.errors);
    return {
      reply: '',
      usedModel: '',
      provider: '雙引擎皆不可用',
      error: `Gemini & Groq 連線異常: ${JSON.stringify(groqRes.errors || groqRes.error)}`
    };
  }

  return {
    reply: '',
    usedModel: '',
    provider: '無可用金鑰',
    error: 'Vercel 尚未偵測到 GEMINI_API_KEY 或 GROQ_API_KEY。'
  };
}

export default async function handler(req, res) {
  const channelSecret = (process.env.LINE_CHANNEL_SECRET || '').trim();
  const channelAccessToken = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  const groqApiKey = (process.env.GROQ_API_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (req.method === 'GET') {
    // 支援直接透過 URL 測試問答：GET /api/line_webhook?q=問題&engine=groq|gemini
    const testQ = req.query?.q || req.query?.test;
    const forceEngine = (req.query?.engine || '').toLowerCase();

    if (testQ) {
      const aiResult = await askSchoolAI(testQ, { geminiApiKey, groqApiKey, forceEngine });
      return res.status(200).json({
        service: '霧臺國小校務 LINE Webhook 雙引擎問答測試',
        question: testQ,
        provider: aiResult.provider,
        usedModel: aiResult.usedModel,
        answer: aiResult.reply,
        debugError: aiResult.error
      });
    }

    let availableGeminiModels = [];
    let modelsError = null;
    if (geminiApiKey) {
      try {
        const mRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': geminiApiKey }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          availableGeminiModels = (mData.models || []).map(m => ({
            name: m.name.replace('models/', ''),
            methods: m.supportedGenerationMethods || []
          }));
        } else {
          modelsError = await mRes.text();
        }
      } catch (e) {
        modelsError = e.message;
      }
    }

    return res.status(200).json({
      service: '霧臺國小校務 LINE Webhook 雙引擎系統運行中',
      version: '3.0.0 (Dual-Engine: Gemini + Groq)',
      architecture: '雙引擎高可用架構 (Google Gemini 主力 + Groq Llama 3.3 秒級自動備援)',
      diagnostics: {
        hasGeminiKey: !!geminiApiKey,
        geminiKeyPrefix: geminiApiKey ? geminiApiKey.slice(0, 6) + '...' : '未設定',
        geminiKeyType: geminiApiKey.startsWith('AQ.') ? 'Google Auth Key (最新標準)' : 'Standard Key',
        hasGroqKey: !!groqApiKey,
        groqKeyPrefix: groqApiKey ? groqApiKey.slice(0, 6) + '...' : '未設定',
        availableGeminiModelsCount: availableGeminiModels.length,
        modelsError,
        hasLineToken: !!channelAccessToken,
        hasLineSecret: !!channelSecret
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // LINE 簽名驗證
  const signature = req.headers['x-line-signature'];
  if (channelSecret && signature) {
    try {
      const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(bodyString)
        .digest('base64');
      
      if (hash !== signature && process.env.NODE_ENV === 'production') {
        console.warn('Signature verification mismatch, proceeding gracefully');
      }
    } catch (err) {
      console.error('Signature error:', err);
    }
  }

  // 容錯解析 Body
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      console.error('Body parse error:', e);
    }
  }

  const events = bodyData?.events || [];
  
  // LINE Console 點擊「Verify」測試時會送出空 events，必須立即回傳 200 OK
  if (events.length === 0) {
    return res.status(200).json({ status: 'verified' });
  }

  // 處理所有接收到的事件
  for (const event of events) {
    if (event.type === 'message' && event.message?.type === 'text') {
      const userMessage = event.message.text.trim();
      const replyToken = event.replyToken;

      try {
        const aiResult = await askSchoolAI(userMessage, { geminiApiKey, groqApiKey });
        let aiReplyText = aiResult.reply;

        // 若無成功回傳之兜底訊息
        if (!aiReplyText) {
          aiReplyText = `您好！我是霧小校務小助手。已收到您的提問：「${userMessage}」。\n\n【系統提醒】：正在連線 AI 服務中，若您有急迫之課表、請假或校務需求，歡迎於上班時間致電學校總機洽詢，謝謝！`;
        }

        // 測試用模式（若 replyToken 為 test，直接將回答回傳於 API 回應中方便診斷）
        if (replyToken === 'test') {
          return res.status(200).json({
            status: 'ok',
            provider: aiResult.provider,
            usedModel: aiResult.usedModel,
            testReply: aiReplyText,
            debugError: aiResult.error
          });
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
        if (replyToken === 'test') {
          return res.status(200).json({
            status: 'error',
            error: eventErr.message,
            stack: eventErr.stack
          });
        }
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}
