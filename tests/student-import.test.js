import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_SYNONYMS,
  normalizeKey,
  findValueByAliases,
  formatStudentDate,
  getStudentFieldValue
} from '../src/lib/studentFields.js';

test('normalizeKey removes spaces, full-width spaces and invisible characters', () => {
  assert.equal(normalizeKey(' 學號 '), '學號');
  assert.equal(normalizeKey('　身分證 字號　'), '身分證字號');
  assert.equal(normalizeKey('父親 電話\r\n'), '父親電話');
  assert.equal(normalizeKey(null), '');
  assert.equal(normalizeKey(undefined), '');
});

test('findValueByAliases accurately matches common synonyms', () => {
  const row = {
    '出生年月日': '980512',
    '身分證號': 'T123456789',
    '父手機': '0912345678',
    '母聯絡電話': '0923456789',
    '緊急聯絡人': '田大山',
    '緊急聯絡電話': '0912345678',
    '戶籍住址': '屏東縣霧臺鄉神山巷1號',
    '聯絡地址': '屏東縣霧臺鄉神山巷1號',
    '英文姓名': 'David',
    '低收入戶': '第2款'
  };

  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['生日']), '980512');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['身分證字號']), 'T123456789');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['父親電話']), '0912345678');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['母親電話']), '0923456789');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['緊急連絡人']), '田大山');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['緊急聯絡人電話']), '0912345678');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['戶籍地址']), '屏東縣霧臺鄉神山巷1號');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['通訊地址']), '屏東縣霧臺鄉神山巷1號');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['英語名']), 'David');
  assert.equal(findValueByAliases(row, FIELD_SYNONYMS['中低軍公教']), '第2款');
});

test('formatStudentDate correctly formats ROC dates, Excel serial numbers and standard dates', () => {
  // 6 碼民國日
  assert.equal(formatStudentDate('980512'), '98/5/12');
  // 7 碼民國日
  assert.equal(formatStudentDate('1010325'), '101/3/25');
  // Excel Serial Date (41234 is 2012-11-21 -> 民國 101/11/21)
  assert.equal(formatStudentDate('41234'), '101/11/21');
  // 已帶有斜線或文字
  assert.equal(formatStudentDate('98/5/12'), '98/5/12');
  assert.equal(formatStudentDate('2009-05-12'), '2009-05-12');
  assert.equal(formatStudentDate(''), '');
});

test('getStudentFieldValue resolves fields from details, aliases, or top-level student object', () => {
  const student = {
    student_id: '1150001',
    name: '田小明',
    grade: '一',
    class_name: '甲',
    seat_number: 1,
    father_phone: '0911111111',
    mother_phone: '0922222222',
    enroll_type: '在學',
    details: {
      '出生年月日': '980512',
      '身分證號': 'T123456789',
      '緊急聯絡人': '田爸爸',
      '緊急聯絡電話': '0933333333',
      '戶籍住址': '神山巷1號',
      '聯絡地址': '神山巷2號'
    }
  };

  // 即使 details 裡放的是「出生年月日」，用「生日」也能查到並自動格式化
  assert.equal(getStudentFieldValue(student, '生日'), '98/5/12');
  // 即使 details 裡放的是「身分證號」，用「身分證字號」也能查到
  assert.equal(getStudentFieldValue(student, '身分證字號'), 'T123456789');
  // 即使 details 沒有「父親電話」，從 student.father_phone 也能查到
  assert.equal(getStudentFieldValue(student, '父親電話'), '0911111111');
  assert.equal(getStudentFieldValue(student, '母親電話'), '0922222222');
  // 即使 Tab 定義叫「緊急連絡人」（絡），Excel 資料叫「緊急聯絡人」（聯），也能順利取得
  assert.equal(getStudentFieldValue(student, '緊急連絡人'), '田爸爸');
  assert.equal(getStudentFieldValue(student, '緊急聯絡人電話'), '0933333333');
  // 地址別名
  assert.equal(getStudentFieldValue(student, '戶籍地址'), '神山巷1號');
  assert.equal(getStudentFieldValue(student, '通訊地址'), '神山巷2號');
});
