// 白名單以逗號儲存角色；必須完整比對，角色 10 不是角色 1 或 0。
export function roleTags(staff) {
  const value = staff?.role_tags;
  return (Array.isArray(value) ? value : String(value ?? '').split(/[,，、\s]+/)).map(String).map(tag => tag.trim()).filter(Boolean);
}

export function isSuperAdmin(staff) {
  return roleTags(staff).includes('0') || Boolean(staff?.email?.includes('u864001'));
}

export function isSchoolAdmin(staff) {
  const tags = roleTags(staff);
  return isSuperAdmin(staff) || ['1', '2', '3'].some(tag => tags.includes(tag)) || (tags.length === 0 && staff?.title === '行政');
}

export function homeroomClass(staff) {
  if (!roleTags(staff).includes('4')) return null;
  const value = String(staff?.class_assigned || staff?.details?.['任教班級'] || '').replace(/[年級班\s]/g, '');
  const normalized = value.replace(/[1-6]/g, digit => '一二三四五六'[Number(digit) - 1]);
  return /^[一二三四五六][甲乙]$/.test(normalized) ? normalized : null;
}

export function canManageRepairs(staff) {
  const tags = roleTags(staff);
  return isSuperAdmin(staff) || ['1', '2', '3', '40'].some(tag => tags.includes(tag)) ||
    String(staff?.department || '').includes('總務');
}

export function studentClass(student) {
  return `${student.grade}${student.class_name}`.replace(/[年級班\s]/g, '').replace(/[1-6]/g, digit => '一二三四五六'[Number(digit) - 1]);
}
