// Khai báo 4 tool theo đúng chuẩn Gemini Function Calling (camelCase JSON)
export const AI_CHAT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'search_flights',
        description:
          'Tìm chuyến bay thật trong hệ thống theo điểm đi, điểm đến, và/hoặc ngày khởi hành. ' +
          'Luôn gọi hàm này khi khách hỏi về chuyến bay cụ thể -- không tự bịa mã chuyến, giá vé, giờ bay.',
        parameters: {
          type: 'OBJECT',
          properties: {
            departureCity: { type: 'STRING', description: 'Tên thành phố điểm đi, để trống nếu khách không nói rõ' },
            arrivalCity: { type: 'STRING', description: 'Tên thành phố điểm đến, để trống nếu khách không nói rõ' },
            date: { type: 'STRING', description: 'Ngày khởi hành dạng YYYY-MM-DD, để trống nếu khách không nói rõ ngày' },
          },
        },
      },
      {
        name: 'lookup_booking_by_code',
        description: 'Tra cứu thông tin 1 vé đã đặt của CHÍNH khách hàng đang chat, dựa theo mã đặt chỗ.',
        parameters: {
          type: 'OBJECT',
          properties: {
            bookingCode: { type: 'STRING', description: 'Mã đặt chỗ dạng TLXXXXXX mà khách cung cấp' },
          },
          required: ['bookingCode'],
        },
      },
      {
        name: 'get_fare_policy',
        description:
          'Lấy chính sách hành lý, hoàn vé, đổi lịch của 1 hạng vé cụ thể (Economy / Economy Saver / Economy An toàn), ' +
          'hoặc tổng quan cả 3 hạng nếu khách không chỉ định tên hạng vé.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fareClassName: {
              type: 'STRING',
              description: 'Tên hạng vé cụ thể, để trống để lấy tổng quan cả 3 hạng',
            },
          },
        },
      },
      {
        name: 'escalate_to_human',
        description:
          'Gọi hàm này khi câu hỏi vượt quá khả năng trả lời của bot (khiếu nại, tranh chấp thanh toán, ' +
          'sự cố kỹ thuật cá nhân, yêu cầu đặc biệt) -- thay vì tự bịa ra câu trả lời không chắc chắn.',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: { type: 'STRING', description: 'Lý do ngắn gọn cần chuyển cho nhân viên hỗ trợ' },
          },
          required: ['reason'],
        },
      },
    ],
  },
];