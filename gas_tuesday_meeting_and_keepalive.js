/**
 * 屏東縣霧臺國民小學 - Google Apps Script (GAS) 自動化擴充腳本
 * 功能 1：每週二自動排定下週二晨會（08:00 ~ 08:40 霧臺校區 視聽教室）並雙向同步至 Supabase
 * 功能 2：定時保活觸發器（Heartbeat），防止 Vercel 冷啟動延遲並防止 Supabase 免費專案閒置休眠
 *
 * 【安裝設定說明】：
 * 1. 開啟您的 Google Apps Script 專案（即目前行事曆部署的指令碼專案）。
 * 2. 在左側「檔案」點選「+」新增指令碼，命名為「Automation」。
 * 3. 貼上本檔案內容。
 * 4. 在左側選單點選「觸發條件（時鐘圖示 Triggers）」：
 *    - 新增觸發條件 -> 選擇「autoScheduleNextTuesdayMeeting」-> 時間驅動 -> 每週計時器 -> 每週一（或二）早上 7:00 至 8:00。
 *    - （可選）新增觸發條件 -> 選擇「keepAliveHeartbeat」-> 時間驅動 -> 分鐘計時器 -> 每 10 分鐘（防止 Vercel 冷啟動與 Supabase 休眠）。
 */

// 學校公開服務端點
var VERCEL_API_URL = 'https://wutpsdata.vercel.app/api/calendar';

/**
 * 1. 自動計算下週二日期並排定晨會
 */
function autoScheduleNextTuesdayMeeting() {
  var today = new Date();
  var currentDay = today.getDay(); // 0 是週日, 1 是週一, 2 是週二...
  
  // 計算距離「下一個週二」的天數 (至少 1 天以上，確保是未來的週二)
  var daysUntilNextTuesday = (2 - currentDay + 7) % 7;
  if (daysUntilNextTuesday === 0) {
    daysUntilNextTuesday = 7; // 若今天剛好是週二，則計算 7 天後的下週二
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

  Logger.log('準備排定晨會日期：' + targetDate);

  // 1. 寫入 Google 日曆 (取得預設日曆或指定日曆)
  try {
    var calendar = CalendarApp.getDefaultCalendar();
    var existingEvents = calendar.getEvents(new Date(targetDate + 'T07:59:00+08:00'), new Date(targetDate + 'T08:41:00+08:00'));
    var alreadyExists = false;
    for (var i = 0; i < existingEvents.length; i++) {
      if (existingEvents[i].getTitle().indexOf('晨會') !== -1) {
        alreadyExists = true;
        Logger.log('該時段已有晨會活動，略過建立：' + existingEvents[i].getTitle());
        break;
      }
    }

    if (!alreadyExists) {
      var event = calendar.createEvent(title, new Date(startTime), new Date(endTime), {
        location: location,
        description: description
      });
      Logger.log('Google 日曆晨會建立成功，ID：' + event.getId());

      // 2. 同步寫入 Vercel & Supabase
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
      Logger.log('同步至校務系統回應：' + res.getContentText());
    }
  } catch (err) {
    Logger.log('自動排定晨會發生錯誤：' + err.message);
  }
}

/**
 * 2. 定時保活探針 (Keep-Alive Heartbeat)
 * 每 10 分鐘自動發送一個極輕量的請求，喚醒 Vercel 與 Supabase
 * 達成：1. 徹底消滅 Vercel 冷啟動 2. 避免 Supabase 免費專案超過 7 天因閒置而暫停
 */
function keepAliveHeartbeat() {
  try {
    var res = UrlFetchApp.fetch(VERCEL_API_URL + '?type=only_all', {
      method: 'get',
      muteHttpExceptions: true
    });
    Logger.log('保活心跳發送成功，狀態碼：' + res.getResponseCode());
  } catch (e) {
    Logger.log('保活心跳發送例外：' + e.message);
  }
}
