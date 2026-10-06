/**
 * 學生欄位標準化、同義詞別名對照與智慧解析工具模組
 * 解決全校各版本 Excel 匯入時欄位名稱大小寫、空白、全半形、異體字及同義詞不一致問題
 * 兼顧線上系統既有欄位與學校原始名冊，實現最大聯集（Maximum Union）
 */

// 各顯示分頁之標準欄位同義詞字典
export const FIELD_SYNONYMS = {
  // 核心識別欄位
  student_id: ['學號', '學生學號', '學籍號碼', 'student_id', '學籍編號', '學生編號'],
  name: ['姓名', '學生姓名', 'name', '學生全名'],
  grade: ['年級', '就讀年級', 'grade', '年級別', '目前年級'],
  class_name: ['班級', '班別', 'class_name', '就讀班級', '目前班級'],
  seat_number: ['座號', 'seat_number', 'seat_no', '學生座號'],
  enroll_type: ['是否在學', '在學或自學', '就學狀態', '在學狀態', '就讀狀態', '在學/自學', '在籍狀態', 'enroll_type', 'enrollment_type'],

  // 基本資料頁 (包含 是否在學)
  '性別': ['性別', '姓別', 'gender', 'sex'],
  '身分證字號': ['身分證字號', '身分證號', '身分證統一編號', '國民身分證統一編號', '身分證號碼', '身分證', '統一編號', 'id_number', 'id_no'],
  '生日': ['生日', '出生年月日', '出生日期', '出生日', '出生年/月/日', '西元生日', '民國生日', 'birthday', 'birth_date'],
  '是否在學': ['是否在學', '在學或自學', '就學狀態', '在學狀態', '就讀狀態', '在學/自學', '在籍狀態', 'enroll_type', 'enrollment_type'],

  // 家庭資料頁
  '父親': ['父親', '父親姓名', '父姓名', '父親稱謂', '父親/監護人', '家長姓名(父)'],
  '父親電話': ['父親電話', '父電話', '父親手機', '父手機', '父親聯絡電話', '父聯絡電話', '父親公話', '父親行動電話', '父親電話號碼', 'father_phone', '父手提'],
  '母親': ['母親', '母親姓名', '母姓名', '母親稱謂', '母親/監護人', '家長姓名(母)'],
  '母親電話': ['母親電話', '母電話', '母親手機', '母手機', '母親聯絡電話', '母聯絡電話', '母親公話', '母親行動電話', '母親電話號碼', 'mother_phone', '母手提'],
  '戶籍地址': ['戶籍地址', '戶籍住址', '戶籍地', '戶口地址', '戶籍所在地', '戶籍地地址', '戶口所在地'],
  '通訊地址': ['通訊地址', '聯絡地址', '居住地址', '現居地址', '通訊處', '現住地址', '聯絡處', '通訊住址', '聯絡住址', '現居地'],

  // 健康與送醫頁 (相容「緊急聯絡人(關係)」、「連絡電話」與全半形括號)
  '緊急聯絡人(關係)': ['緊急聯絡人(關係)', '緊急聯絡人（關係）', '緊急連絡人(關係)', '緊急連絡人（關係）', '緊急聯絡人', '緊急連絡人', '聯絡人', '連絡人', '監護人', '緊急聯絡人姓名', '緊急連絡人姓名', '聯絡人姓名', '緊急聯絡人(稱謂)'],
  '緊急連絡人': ['緊急連絡人', '緊急聯絡人(關係)', '緊急聯絡人（關係）', '緊急連絡人(關係)', '緊急連絡人（關係）', '緊急聯絡人', '聯絡人', '連絡人', '監護人', '緊急聯絡人姓名', '緊急連絡人姓名', '聯絡人姓名', '緊急聯絡人(稱謂)'],
  '緊急聯絡人': ['緊急聯絡人', '緊急聯絡人(關係)', '緊急聯絡人（關係）', '緊急連絡人(關係)', '緊急連絡人（關係）', '緊急連絡人', '聯絡人', '連絡人', '監護人', '緊急聯絡人姓名', '緊急連絡人姓名', '聯絡人姓名', '緊急聯絡人(稱謂)'],
  '連絡電話': ['連絡電話', '聯絡電話', '緊急聯絡人電話', '緊急連絡人電話', '緊急聯絡電話', '緊急連絡電話', '聯絡人電話', '連絡人電話', '聯絡人手機', '連絡人手機', '緊急電話', '緊急手機', '緊急連絡電話號碼', '緊急聯絡人手機'],
  '緊急聯絡人電話': ['緊急聯絡人電話', '緊急連絡人電話', '連絡電話', '聯絡電話', '緊急聯絡電話', '緊急連絡電話', '聯絡人電話', '連絡人電話', '聯絡人手機', '連絡人手機', '緊急電話', '緊急手機', '緊急連絡電話號碼', '緊急聯絡人手機'],
  '緊急連絡人電話': ['緊急連絡人電話', '緊急聯絡人電話', '連絡電話', '聯絡電話', '緊急聯絡電話', '緊急連絡電話', '聯絡人電話', '連絡人電話', '聯絡人手機', '連絡人手機', '緊急電話', '緊急手機', '緊急連絡電話號碼', '緊急聯絡人手機'],
  '特殊病況': ['特殊病況', '特殊病史', '重大傷病', '過敏史', '重大疾病', '病史', '特殊疾病', '特殊狀況', '痼疾', '健康狀況', '疾病史'],
  '緊急送醫處': ['緊急送醫處', '送醫醫院', '緊急送醫醫院', '就近送醫醫院', '就近送醫處', '送醫地點', '就醫醫院', '就近醫院'],

  // 族語與本土語頁
  '族名': ['族名', '原住民族名', '原住民姓名', '族語名字', '族語姓名', '原住民族名姓名', '傳統姓名'],
  '族別': ['族別', '原住民族別', '族群', '原住民族群', '族別名稱'],
  '語系': ['語系', '族語語系', '語言別', '族語別', '本土語系', '語別', '方言別'],
  '族語認證': ['族語認證', '認證級別', '族語級別', '族語能力認證', '原住民族語認證', '認證等級'],
  '新增族語註記': ['新增族語註記', '族語註記', '族語備註', '原民備註', '族語備查'],

  // 英語能力頁
  '英文名': ['英文名', '英語名', '英文姓名', '英語姓名', 'English Name', '英文名字', '外文姓名'],
  '英語名': ['英語名', '英文名', '英文姓名', '英語姓名', 'English Name', '英文名字', '外文姓名'],
  '新增英語註記': ['新增英語註記', '英語註記', '英文備註', '英語備註'],

  // 身分與特教頁 (獨立分出 身心障礙手冊 與 特教生障別)
  '中低軍公教': ['中低軍公教', '中低收入戶', '低收入戶', '中低收', '低收', '弱勢身分', '弱勢補助', '軍公教', '中低或低收', '身分別', '清寒身分', '清寒證明'],
  '身心障礙手冊': ['身心障礙手冊', '身心障礙證明', '身障手冊', '殘障手冊', '身障證明', '身心障礙類別', '身障鑑輔', '身心障礙'],
  '特教生障別': ['特教生障別', '特教生障礙類別', '特教障別', '鑑輔會障別', '障別', '障礙類別', '特教類別'],
  '特教生': ['特教生', '特教身分', '特教', '鑑輔會核定', '資源班', '特殊教育'],
  '輔導個案': ['輔導個案', '認輔個案', '輔導身分', '個案', '輔導記錄', '高關懷', '輔導個案別'],

  // 經費與獎助頁
  '獎學金': ['獎學金', '獎助學金', '助學金', '就學補助', '獎金'],
  '獎助學金': ['獎助學金', '獎學金', '助學金', '就學補助', '獎金'],
  '午餐費': ['午餐費', '營養午餐', '午餐補助', '午餐退費', '午餐繳費'],
  '代辦費': ['代辦費', '學雜費', '代收代辦費', '代辦費用'],
  '平安保險費': ['平安保險費', '學生保險', '平安保險', '保險費', '學保', '學生平安保險'],
  '教科書費': ['教科書費', '書籍費', '課本費', '書費', '教科書'],
  '家長會費': ['家長會費', '家長會'],
  '運動服費': ['運動服費', '服裝費', '制服費', '運動服']
};

/**
 * 清除字串前後及內部多餘空白、全形空格與隱藏字元
 */
export function normalizeKey(key) {
  if (key === undefined || key === null) return '';
  return String(key)
    .replace(/[\s\uFEFF\xA0\r\n\t]+/g, '')
    .trim();
}

/**
 * 依據別名清單，從鍵值物件中比對出最佳數值
 * @param {Object} rowMap - 已正規化鍵名的資料物件
 * @param {string[]} aliases - 候選別名清單
 * @returns {any} 找到的值，若無則回傳空字串 ''
 */
export function findValueByAliases(rowMap, aliases = []) {
  if (!rowMap || typeof rowMap !== 'object') return '';

  // 1. 精準比對
  for (const alias of aliases) {
    const cleanAlias = normalizeKey(alias);
    if (rowMap[cleanAlias] !== undefined && rowMap[cleanAlias] !== null && String(rowMap[cleanAlias]).trim() !== '') {
      return rowMap[cleanAlias];
    }
  }

  // 2. 忽略空白與包含比對鍵值（僅限長度 >= 2 之關鍵字，且排除可能造成誤判之泛用詞）
  const keys = Object.keys(rowMap);
  for (const alias of aliases) {
    const cleanAlias = normalizeKey(alias);
    if (cleanAlias.length < 2) continue;
    const matchedKey = keys.find(k => k === cleanAlias || k.includes(cleanAlias) || cleanAlias.includes(k));
    if (matchedKey && rowMap[matchedKey] !== undefined && rowMap[matchedKey] !== null && String(rowMap[matchedKey]).trim() !== '') {
      return rowMap[matchedKey];
    }
  }

  return '';
}

/**
 * 日期智慧轉換（支援 Excel 序號、民國年 6/7 碼、西元 8 碼、斜線與連字號格式）
 */
export function formatStudentDate(val) {
  if (val === undefined || val === null || val === '') return '';
  const strVal = String(val).trim();
  if (strVal.includes('/') || strVal.includes('-') || strVal.includes('年')) return strVal;

  const num = Number(strVal);
  // Excel Serial Date (1900 基礎天數，通常在 10000 ~ 70000 之間)
  if (!isNaN(num) && num > 10000 && num < 70000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    const year = date.getUTCFullYear() - 1911;
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return `${year}/${month}/${day}`;
  }

  // 西元年月日 8 碼數字（如 20150901 -> 104/9/1）
  if (/^\d{8}$/.test(strVal)) {
    const rocYear = parseInt(strVal.slice(0, 4), 10) - 1911;
    const month = parseInt(strVal.slice(4, 6), 10);
    const day = parseInt(strVal.slice(6, 8), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${rocYear}/${month}/${day}`;
    }
  }

  // 民國年月日數字（如 980512 -> 98/5/12，或 1010325 -> 101/3/25）
  if (/^\d{6,7}$/.test(strVal)) {
    const year = strVal.length === 7 ? strVal.slice(0, 3) : strVal.slice(0, 2);
    const month = parseInt(strVal.slice(-4, -2), 10);
    const day = parseInt(strVal.slice(-2), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${parseInt(year, 10)}/${month}/${day}`;
    }
  }

  return strVal;
}

/**
 * 智慧解析年級與班級（支援：行內欄位 -> Sheet 名稱 -> 學號前綴推導）
 */
export function inferGradeAndClass({ row = {}, sheetName = '', studentId = '', currentAcademicYear = 115 } = {}) {
  let grade = '';
  let className = '';

  // 1. 先從行內資料找 (年級, 班級)
  const rawGrade = findValueByAliases(row, FIELD_SYNONYMS.grade);
  const rawClass = findValueByAliases(row, FIELD_SYNONYMS.class_name);
  if (rawGrade) grade = String(rawGrade).trim();
  if (rawClass) className = String(rawClass).trim();

  // 2. 若缺少，從工作表名稱解析 (如 "一甲", "1甲", "一年甲班", "六乙", "6-2", "301")
  if ((!grade || !className) && sheetName) {
    const sName = String(sheetName).trim();
    if (!grade) {
      const gMatch = sName.match(/[一二三四五六1-6]/);
      if (gMatch) {
        const digitMap = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
        grade = digitMap[gMatch[0]] || gMatch[0];
      }
    }
    if (!className) {
      const cMatch = sName.match(/[甲乙丙丁A-Da-d]/);
      if (cMatch) {
        const classMap = { 'A': '甲', 'B': '乙', 'C': '丙', 'D': '丁', 'a': '甲', 'b': '乙', 'c': '丙', 'd': '丁' };
        className = classMap[cMatch[0]] || cMatch[0];
      }
    }
  }

  // 3. 若年級依然缺少，從學號 (student_id) 前綴推導
  // 霧臺國小 115 學年度：115 開頭為一年級、114 為二年級、113 為三年級、112 為四年級、111 為五年級、110 為六年級
  const cleanId = String(studentId || findValueByAliases(row, FIELD_SYNONYMS.student_id) || '').trim();
  if (!grade && cleanId.length >= 3) {
    const entryYear = parseInt(cleanId.slice(0, 3), 10);
    if (!isNaN(entryYear) && entryYear >= 100 && entryYear <= currentAcademicYear) {
      const calculatedGradeNum = currentAcademicYear - entryYear + 1;
      if (calculatedGradeNum >= 1 && calculatedGradeNum <= 6) {
        const digitMap = ['一', '二', '三', '四', '五', '六'];
        grade = digitMap[calculatedGradeNum - 1];
      }
    }
  }

  // 4. 若班級依然缺少，但年級有值，小校預設為甲班
  if (!className && grade) {
    className = '甲';
  }

  return { grade, class_name: className };
}

/**
 * 從學生物件中安全讀取指定欄位的值（含 details 模糊與別名解析）
 */
export function getStudentFieldValue(student, colName) {
  if (!student) return '';
  const details = student.details || {};

  // 1. 先查 details 原生欄位 (完全比對)
  if (details[colName] !== undefined && details[colName] !== null && String(details[colName]).trim() !== '') {
    return colName === '生日' ? formatStudentDate(details[colName]) : details[colName];
  }

  // 2. 查標準別名庫
  const aliases = FIELD_SYNONYMS[colName] || [colName];
  const found = findValueByAliases(details, aliases);
  if (found !== undefined && found !== null && String(found).trim() !== '') {
    return colName === '生日' ? formatStudentDate(found) : found;
  }

  // 3. 查頂層直屬欄位（相容 father_phone, mother_phone, enroll_type, gender, student_id 等直屬屬性）
  if (colName === '父親電話' && student.father_phone) return student.father_phone;
  if (colName === '母親電話' && student.mother_phone) return student.mother_phone;
  if (['在學或自學', '就學狀態', '是否在學'].includes(colName)) {
    const val = student.enroll_type || student.enrollment_type || '';
    if (val === '在') return '在學';
    if (val === '自') return '自學';
    return val;
  }
  if (colName === '性別' && student.gender) return student.gender;
  if (colName === '學號' && student.student_id) return student.student_id;
  if (colName === '座號' && (student.seat_number !== undefined && student.seat_number !== null)) return student.seat_number;
  if (colName === '姓名' && student.name) return student.name;
  if (colName === '年級' && student.grade) return student.grade;
  if (colName === '班級' && student.class_name) return student.class_name;

  return '';
}
