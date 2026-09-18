/**
 * ==============================================================================
 * 屏東縣霧臺國民小學 - Google Apps Script (GAS) 自動化擴充腳本
 * 
 * 功能 1：每週二自動計算並排定下週二教師晨會（08:00 ~ 08:40 霧臺校區 視聽教室）
 *        自動雙軌同步至 Google 日曆 與 Supabase 資料庫。
 * 功能 2：定時保活觸發器（Heartbeat），每 10 分鐘自動喚醒，
 *        徹底消除 Vercel 冷啟動延遲，並永久防止 Supabase 免費專案閒置休眠。
 * ==============================================================================
 */

// 霧臺國小校務系統 API 端點
var VERCEL_API_URL = 'https://wutpsdata.vercel.app/api/calendar';
var VERCEL_WEBHOOK_URL = 'https://wutpsdata.vercel.app/api/line_webhook';

/**
 * 【任務 1】：自動排定下週二「教師晨會」
 * 時間：每週二早上 08:00 ~ 08:40
 * 地點：霧臺校區 視聽教室
 */
function autoScheduleNextTuesdayMeeting() {
  var today = new Date();
  var currentDay = today.getDay(); // 0 是週日, 1 是週一, 2 是週二...
  
  // 計算距離「下一個週二」的天數 (至少 1 天以上，確保是未來的週二)
  var daysUntilNextTuesday = (2 - currentDay + 7) % 7;
  if (daysUntilNextTuesday === 0) {
    daysUntilNextTuesday = 7; // 若今天剛好是週二，則排定 7 天後的下週二
  }
  
  var nextTuesday = new Date(today.getTime() + daysUntilNextTuesday * 24 * 60 * 60 * 1000);
  
  var year = nextTuesday.getFullYear();
  var month = ('0' + (nextTuesday.getMonth() + 1)).slice(-2);
  var dateStr = ('0' + nextTuesday.getDate()).slice(-2);
  var targetDate = year + '-' + month + '-' + dateStr;
  
  var startTime = targetDate + 'T08:00:00+08:00';
  var endTime = targetDate + 'T08:40:00+08:00';
  var title = '教師晨會';
  var location = '霧臺校區 視聽教室';
  var description = '【承辦處室】：教務處\n【對象班級】：全校教職員\n【學校節次】：早自習 至 第 1 節\n【詳細備註】：全校例行教師晨會（系統排程自動排定）';

  Logger.log('準備排定晨會目標日期：' + targetDate);

  try {
    // 1. 先向校務系統檢查該日期是否已經排有晨會，避免重複建立
    var checkRes = UrlFetchApp.fetch(VERCEL_API_URL + '?type=all', { muteHttpExceptions: true });
    if (checkRes.getResponseCode() === 200) {
      var checkData = JSON.parse(checkRes.getContentText());
      if (checkData.status === 'success' && Array.isArray(checkData.data)) {
        var alreadyExists = checkData.data.some(function(ev) {
          var evDate = (ev.start || '').slice(0, 10);
          return evDate === targetDate && (ev.title || '').indexOf('晨會') !== -1;
        });
        if (alreadyExists) {
          Logger.log('目標日期 ' + targetDate + ' 已存在晨會活動，略過重複建立。');
          return;
        }
      }
    }

    // 2. 呼叫校務 API 建立活動（系統會同時寫入 Supabase 並自動推送到 Google 日曆）
    var payload = {
      action: 'create',
      calendarType: 'all',
      title: title,
      location: location,
      description: description,
      startTime: startTime,
      endTime: endTime,
      isAllDay: false,
      periodInfo: '早自習 至 第 1 節',
      targetGrades: '全校教職員',
      department: '教務處',
      creatorName: '晨會自動排程系統'
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch(VERCEL_API_URL, options);
    Logger.log('排程建立回應：' + res.getContentText());
  } catch (err) {
    Logger.log('自動排定晨會發生錯誤：' + err.message);
  }
}

/**
 * 【任務 2】：定時保活探針 (Keep-Alive Heartbeat)
 * 頻率：建議每 5~10 分鐘執行一次
 * 效益：
 * 1. 同時喚醒行事曆 API 與 LINE AI 機器人 Webhook，徹底消滅 Vercel 冷啟動延遲。
 * 2. 每 10 分鐘查詢一次 Supabase，永久防止 Supabase 免費專案因 7 天閒置而休眠。
 */
function keepAliveHeartbeat() {
  try {
    // 1. 保活行事曆與 Supabase 資料庫
    var calRes = UrlFetchApp.fetch(VERCEL_API_URL + '?type=only_all', {
      method: 'get',
      muteHttpExceptions: true
    });
    Logger.log('行事曆保活心跳成功，HTTP 狀態碼：' + calRes.getResponseCode());

    // 2. 保活 LINE AI 自動問答 Webhook 實例
    var webhookRes = UrlFetchApp.fetch(VERCEL_WEBHOOK_URL, {
      method: 'get',
      muteHttpExceptions: true
    });
    Logger.log('LINE AI Webhook 保活心跳成功，HTTP 狀態碼：' + webhookRes.getResponseCode());
  } catch (e) {
    Logger.log('保活心跳發送例外：' + e.message);
  }
}
