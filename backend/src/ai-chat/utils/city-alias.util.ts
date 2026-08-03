const CITY_ALIAS_MAP: Record<string, string> = {
  // Hồ Chí Minh
  'sg': 'Hồ Chí Minh', 'saigon': 'Hồ Chí Minh', 'saigòn': 'Hồ Chí Minh',
  'tphcm': 'Hồ Chí Minh', 'hcm': 'Hồ Chí Minh', 'hochiminh': 'Hồ Chí Minh',
  // Hà Nội
  'hn': 'Hà Nội', 'hanoi': 'Hà Nội',
  // Đà Nẵng
  'dn': 'Đà Nẵng', 'danang': 'Đà Nẵng',
  // Nha Trang
  'nt': 'Nha Trang', 'nhatrang': 'Nha Trang',
  // Phú Quốc
  'pq': 'Phú Quốc', 'phuquoc': 'Phú Quốc',
  // Đà Lạt
  'dl': 'Đà Lạt', 'dalat': 'Đà Lạt',
  // Cần Thơ
  'ct': 'Cần Thơ', 'cantho': 'Cần Thơ',
  // Hải Phòng
  'hp': 'Hải Phòng', 'haiphong': 'Hải Phòng',
  // Quy Nhơn
  'qn': 'Quy Nhơn', 'quynhon': 'Quy Nhơn',
  // Huế
  'hue': 'Huế',
};

export const KNOWN_CITIES = [
  'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Nha Trang',
  'Phú Quốc', 'Huế', 'Đà Lạt', 'Cần Thơ', 'Hải Phòng', 'Quy Nhơn',
];

// Bỏ dấu, viết thường, xóa khoảng trắng -- dùng làm key tra cứu alias
function toLookupKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

// Chuyển alias ("sg", "tphcm"...) về tên chuẩn có dấu để khớp đúng dữ liệu DB.
// Nếu không khớp alias nào, trả về nguyên input (có thể model đã tự đưa đúng tên chuẩn rồi).
export function normalizeCityName(input?: string): string | undefined {
  if (!input) return undefined;
  const key = toLookupKey(input);
  return CITY_ALIAS_MAP[key] || input;
}

// Tìm các thành phố chuẩn được nhắc tới trong 1 đoạn text bất kỳ (dùng cho heuristic summary)
export function extractMentionedCities(text: string): string[] {
  return KNOWN_CITIES.filter((c) => text.includes(c));
}