// Không chặn tuyệt đối (không có cách nào chặn 100% qua string matching), nhưng phát hiện
// các pattern rõ ràng cố "vượt rào" system prompt để cảnh báo/ghi log, và làm sạch trước khi đưa vào contents
const INJECTION_PATTERNS = [
  /bỏ qua (mọi |toàn bộ )?(hướng dẫn|chỉ dẫn|system prompt|quy tắc)/i,
  /ignore (all |previous )?(instructions|system prompt|rules)/i,
  /bạn (giờ|bây giờ) là/i,
  /you are now/i,
  /disregard/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

// Nguyên tắc quan trọng nhất chống injection thật sự: KHÔNG BAO GIỜ tin dữ liệu do model tự "quyết định"
// cho các trường có giá trị tiền/quyền hạn -- giá vé, quyền truy cập luôn lấy từ DB thật (đã đúng từ đầu
// vì tool search_flights/lookup_booking luôn query DB, model không tự "phát minh" ra số liệu được trả về client)
export function sanitizeToolResult(result: unknown): unknown {
  // Loại bỏ field lạ nếu model cố nhét thêm field không mong muốn vào args truyền cho tool
  if (typeof result === 'object' && result !== null) {
    return JSON.parse(JSON.stringify(result)); // deep clone, cắt đứt tham chiếu, tránh prototype pollution
  }
  return result;
}