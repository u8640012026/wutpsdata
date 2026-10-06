import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_SYNONYMS,
  normalizeKey,
  findValueByAliases,
  formatStudentDate,
  inferGradeAndClass,
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

test('findValueByAliases handles user exact raw Excel headers seamlessly', () => {
  const rawExcelRow = {
    '學號': '1150005',
    '座號': '5',
    '姓名': '杜小明',
    '性別': '男',
    '身分證字號': 'T123456789',
    '生日': '1080315',
    '戶籍地址': '屏東縣霧臺鄉霧臺村神山巷10號',
    '通訊地址': '屏東縣霧臺鄉霧臺村神山巷10號',
    '父親': '杜大明',
    '父親電話': '0911000111',
    '母親': '柯小美',
    '母親電話': '0922000222',
    '緊急聯絡人(關係)': '柯外公(外祖父)',
    '連絡電話': '0933000333',
    '特殊病況': '蠶豆症',
    '緊急送醫處': '屏基醫院',
    '族名': 'Laladeng',
    '族別': '魯凱族',
    '語系': '霧臺魯凱語',
    '中低軍公教': '中低收入戶',
    '身心障礙手冊': '無',
    '特教生障別': '無'
  };

  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['緊急聯絡人(關係)']), '柯外公(外祖父)');
  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['緊急連絡人']), '柯外公(外祖父)');
  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['連絡電話']), '0933000333');
  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['緊急聯絡人電話']), '0933000333');
  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['身心障礙手冊']), '無');
  assert.equal(findValueByAliases(rawExcelRow, FIELD_SYNONYMS['特教生障別']), '無');
});

test('formatStudentDate correctly formats ROC dates, Excel serial numbers and 8-digit dates', () => {
  // 6 碼民國日
  assert.equal(formatStudentDate('980512'), '98/5/12');
  // 7 碼民國日
  assert.equal(formatStudentDate('1010325'), '101/3/25');
  // 8 碼西元日 (20150901 -> 104/9/1)
  assert.equal(formatStudentDate('20150901'), '104/9/1');
  // Excel Serial Date (41234 is 2012-11-21 -> 民國 101/11/21)
  assert.equal(formatStudentDate('41234'), '101/11/21');
  // 已帶有斜線或文字
  assert.equal(formatStudentDate('98/5/12'), '98/5/12');
  assert.equal(formatStudentDate('2009-05-12'), '2009-05-12');
  assert.equal(formatStudentDate(''), '');
});

test('inferGradeAndClass accurately derives grade and class from row, sheet, or student ID', () => {
  // 1. 行內已有
  assert.deepEqual(
    inferGradeAndClass({ row: { '年級': '二', '班級': '乙' }, sheetName: 'Sheet1', studentId: '1140001' }),
    { grade: '二', class_name: '乙' }
  );

  // 2. 從 Sheet 名稱推導
  assert.deepEqual(
    inferGradeAndClass({ row: {}, sheetName: '一甲', studentId: '' }),
    { grade: '一', class_name: '甲' }
  );
  assert.deepEqual(
    inferGradeAndClass({ row: {}, sheetName: '三年乙班', studentId: '' }),
    { grade: '三', class_name: '乙' }
  );

  // 3. 行內無、Sheet 無，從學號 115 開頭推導為一年級 (115學年度)
  assert.deepEqual(
    inferGradeAndClass({ row: {}, sheetName: '學生名冊', studentId: '1150005', currentAcademicYear: 115 }),
    { grade: '一', class_name: '甲' }
  );
  assert.deepEqual(
    inferGradeAndClass({ row: {}, sheetName: '學生名冊', studentId: '1130022', currentAcademicYear: 115 }),
    { grade: '三', class_name: '甲' }
  );
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
    enroll_type: '在',
    details: {
      '出生年月日': '980512',
      '身分證號': 'T123456789',
      '緊急聯絡人(關係)': '田爺爺(祖父)',
      '連絡電話': '0933333333',
      '戶籍住址': '神山巷1號',
      '聯絡地址': '神山巷2號',
      '身心障礙手冊': '輕度聽障',
      '特教生障別': '聽覺障礙',
      '英文名': 'Johnny',
      '獎學金': '原住民優秀學生獎學金'
    }
  };

  // 生日智慧格式化
  assert.equal(getStudentFieldValue(student, '生日'), '98/5/12');
  // 身分證字號別名
  assert.equal(getStudentFieldValue(student, '身分證字號'), 'T123456789');
  // 父母電話
  assert.equal(getStudentFieldValue(student, '父親電話'), '0911111111');
  assert.equal(getStudentFieldValue(student, '母親電話'), '0922222222');
  // 緊急聯絡人(關係) 與 連絡電話
  assert.equal(getStudentFieldValue(student, '緊急聯絡人(關係)'), '田爺爺(祖父)');
  assert.equal(getStudentFieldValue(student, '連絡電話'), '0933333333');
  // 特教與身心障礙手冊獨立欄位
  assert.equal(getStudentFieldValue(student, '身心障礙手冊'), '輕度聽障');
  assert.equal(getStudentFieldValue(student, '特教生障別'), '聽覺障礙');
  // 是否在學 (頂層 enroll_type '在' 自動轉 '在學')
  assert.equal(getStudentFieldValue(student, '是否在學'), '在學');
  // 英文名
  assert.equal(getStudentFieldValue(student, '英文名'), 'Johnny');
  // 獎學金
  assert.equal(getStudentFieldValue(student, '獎學金'), '原住民優秀學生獎學金');
});
