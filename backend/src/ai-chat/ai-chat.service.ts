import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Flight } from '../flights/entities/flight.entity';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { ChatMessage, ChatRole } from './entities/chat-message.entity';

const MAX_HISTORY_MESSAGES = 12; // giới hạn để không phình prompt quá dài, tốn token

@Injectable()
export class AiChatService {
  private logger = new Logger('AiChatService');
  private readonly apiKey: string;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

  constructor(
    private config: ConfigService,
    @InjectRepository(Flight) private flightsRepository: Repository<Flight>,
    @InjectRepository(Booking) private bookingsRepository: Repository<Booking>,
    @InjectRepository(ChatMessage) private chatMessagesRepository: Repository<ChatMessage>,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') || '';
  }

  // ===== LỊCH SỬ HỘI THOẠI — lưu thật vào DB, không phụ thuộc frontend gửi lại =====
  async getHistory(userId: string): Promise<{ role: ChatRole; text: string }[]> {
    const messages = await this.chatMessagesRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: MAX_HISTORY_MESSAGES,
    });
    return messages.reverse().map((m) => ({ role: m.role, text: m.text }));
  }

  private async saveMessage(userId: string, role: ChatRole, text: string): Promise<void> {
    const message = this.chatMessagesRepository.create({
      user: { id: userId } as any,
      role,
      text,
    });
    await this.chatMessagesRepository.save(message);
  }

  async clearHistory(userId: string): Promise<{ message: string }> {
    await this.chatMessagesRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :userId', { userId })
      .execute();
    return { message: 'Đã xóa lịch sử hội thoại' };
  }

  // ===== TÌM CHUYẾN BAY LIÊN QUAN (đã sửa ở bước trước — giữ nguyên logic exact-match) =====
  private async findRelevantFlights(message: string): Promise<Flight[]> {
    const cities = [
      'Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Nha Trang',
      'Phú Quốc', 'Huế', 'Đà Lạt', 'Cần Thơ', 'Hải Phòng', 'Quy Nhơn',
    ];
    const mentionedCities = cities.filter((c) => message.includes(c));

    if (mentionedCities.length >= 2) {
      const exactQuery = this.flightsRepository.createQueryBuilder('flight');
      const conditions: string[] = [];
      const params: Record<string, string> = {};

      for (let i = 0; i < mentionedCities.length; i++) {
        for (let j = 0; j < mentionedCities.length; j++) {
          if (i === j) continue;
          const depKey = `dep${i}_${j}`;
          const arrKey = `arr${i}_${j}`;
          conditions.push(`(flight.departureCity ILIKE :${depKey} AND flight.arrivalCity ILIKE :${arrKey})`);
          params[depKey] = `%${mentionedCities[i]}%`;
          params[arrKey] = `%${mentionedCities[j]}%`;
        }
      }

      exactQuery.where(conditions.join(' OR '), params);
      this.applyDateFilter(exactQuery, message);
      const exactMatches = await exactQuery.orderBy('flight.departureTime', 'ASC').limit(8).getMany();
      if (exactMatches.length > 0) return exactMatches;
    }

    const fallbackQuery = this.flightsRepository.createQueryBuilder('flight');
    let hasFilter = false;

    if (mentionedCities.length > 0) {
      mentionedCities.forEach((city, i) => {
        fallbackQuery.orWhere(`flight.departureCity ILIKE :city${i} OR flight.arrivalCity ILIKE :city${i}`, {
          [`city${i}`]: `%${city}%`,
        });
      });
      hasFilter = true;
    }

    hasFilter = this.applyDateFilter(fallbackQuery, message) || hasFilter;

    if (!hasFilter) {
      fallbackQuery.where('flight.departureTime >= :now', { now: new Date() });
    }

    return fallbackQuery.orderBy('flight.departureTime', 'ASC').limit(8).getMany();
  }

  private applyDateFilter(query: any, message: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (/hôm nay|today/i.test(message)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.andWhere('flight.departureTime >= :start AND flight.departureTime < :end', {
        start: today, end: tomorrow,
      });
      return true;
    }
    if (/ngày mai|tomorrow/i.test(message)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);
      query.andWhere('flight.departureTime >= :start AND flight.departureTime < :end', {
        start: tomorrow, end: dayAfter,
      });
      return true;
    }
    return false;
  }

  // ===== LỊCH SỬ ĐẶT VÉ THẬT — dùng để cá nhân hóa gợi ý =====
  private async getUserBookingProfile(userId: string): Promise<{
    bookingCount: number;
    favoriteCities: string[];
    favoriteFareClass: string | null;
  }> {
    const bookings = await this.bookingsRepository.find({
      where: { user: { id: userId }, status: BookingStatus.CONFIRMED },
      relations: ['seat', 'seat.flight', 'fareClass'],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (bookings.length === 0) {
      return { bookingCount: 0, favoriteCities: [], favoriteFareClass: null };
    }

    const cityCounts: Record<string, number> = {};
    const fareClassCounts: Record<string, number> = {};

    for (const b of bookings) {
      const dest = b.seat.flight.arrivalCity;
      cityCounts[dest] = (cityCounts[dest] || 0) + 1;
      const fareName = b.fareClass.name;
      fareClassCounts[fareName] = (fareClassCounts[fareName] || 0) + 1;
    }

    const favoriteCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city]) => city);

    const favoriteFareClass =
      Object.entries(fareClassCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return { bookingCount: bookings.length, favoriteCities, favoriteFareClass };
  }

  // ===== GỢI Ý CHUYẾN BAY LIÊN QUAN TỚI SỞ THÍCH (dựa trên thành phố hay đến) =====
  private async findSuggestedFlights(favoriteCities: string[]): Promise<Flight[]> {
    if (favoriteCities.length === 0) return [];

    const query = this.flightsRepository.createQueryBuilder('flight');
    favoriteCities.forEach((city, i) => {
      query.orWhere(`flight.arrivalCity ILIKE :fc${i}`, { [`fc${i}`]: `%${city}%` });
    });

    return query
      .andWhere('flight.departureTime >= :now', { now: new Date() })
      .orderBy('flight.departureTime', 'ASC')
      .limit(3)
      .getMany();
  }

  private buildSystemInstruction(
    flightsContext: Flight[],
    profile: { bookingCount: number; favoriteCities: string[]; favoriteFareClass: string | null },
    suggestedFlights: Flight[],
  ): string {
    let context = '';
    if (flightsContext.length > 0) {
      context =
        '\n\nDữ liệu chuyến bay thật khớp với câu hỏi (chỉ dùng thông tin này, không tự bịa thêm):\n' +
        flightsContext
          .map(
            (f) =>
              `- ${f.flightCode}: ${f.departureCity} → ${f.arrivalCity}, khởi hành ${new Date(
                f.departureTime,
              ).toLocaleString('vi-VN')}, giá từ ${Number(f.price).toLocaleString('vi-VN')}đ`,
          )
          .join('\n');
    } else {
      context = '\n\nHiện không có chuyến bay nào khớp trong hệ thống.';
    }

    let personalization = '';
    if (profile.bookingCount > 0) {
      personalization = `\n\nThông tin khách hàng này (dùng để cá nhân hóa lời chào và gợi ý, đừng liệt kê máy móc):
- Đã đặt ${profile.bookingCount} vé thành công trước đây
- Điểm đến hay đi nhất: ${profile.favoriteCities.join(', ') || 'chưa rõ'}
- Hạng vé hay chọn: ${profile.favoriteFareClass || 'chưa rõ'}`;

      if (suggestedFlights.length > 0) {
        personalization +=
          '\n\nChuyến bay gợi ý phù hợp sở thích (chỉ đề xuất nếu khách hỏi mở, đừng ép nếu không liên quan):\n' +
          suggestedFlights
            .map(
              (f) =>
                `- ${f.flightCode}: ${f.departureCity} → ${f.arrivalCity}, ${new Date(
                  f.departureTime,
                ).toLocaleDateString('vi-VN')}, ${Number(f.price).toLocaleString('vi-VN')}đ`,
            )
            .join('\n');
      }
    }

    return `Bạn là trợ lý ảo của TripLock — nền tảng đặt vé máy bay. Nhiệm vụ của bạn:
- Trả lời ngắn gọn, thân thiện, luôn bằng tiếng Việt
- Nhớ ngữ cảnh hội thoại trước đó với khách (được cung cấp trong lịch sử chat)
- Nếu danh sách chuyến bay bên dưới không rỗng, dùng nó để trả lời trực tiếp
- Nếu khách là khách quen (đã có lịch sử đặt vé), có thể chào thân thiện hơn và gợi ý chuyến bay phù hợp sở thích khi hợp lý, nhưng KHÔNG tự bịa ra mã giảm giá hay ưu đãi % không có thật -- chỉ gợi ý điểm đến/hạng vé dựa trên thói quen thật của khách
- Nếu khách hỏi về tuyến cụ thể không có trong dữ liệu, nói rõ chưa có và gợi ý tuyến đang có sẵn
- KHÔNG bịa mã chuyến bay, giá vé, giờ bay không có trong dữ liệu
- Nếu khách hỏi ngoài chủ đề du lịch/đặt vé, lịch sự từ chối và hướng về chủ đề chính
- Giữ câu trả lời dưới 120 từ${context}${personalization}`;
  }

  // ===== HÀM CHÍNH — giờ tự load history từ DB, tự lưu lại cả 2 chiều =====
  async sendMessage(userId: string, userMessage: string): Promise<string> {
    if (!this.apiKey) {
      throw new BadRequestException('Chatbot AI chưa được cấu hình (thiếu GEMINI_API_KEY)');
    }

    const [relevantFlights, profile, history] = await Promise.all([
      this.findRelevantFlights(userMessage),
      this.getUserBookingProfile(userId),
      this.getHistory(userId),
    ]);

    const suggestedFlights = await this.findSuggestedFlights(profile.favoriteCities);
    const systemInstruction = this.buildSystemInstruction(relevantFlights, profile, suggestedFlights);

    const contents = [
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    try {
      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 350 },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );

      const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw new Error('Gemini API trả về response rỗng');

      const trimmedReply = reply.trim();

      // Lưu cả 2 chiều hội thoại vào DB -- đây chính là "bộ nhớ" thật, không phụ thuộc frontend
      await this.saveMessage(userId, ChatRole.USER, userMessage);
      await this.saveMessage(userId, ChatRole.MODEL, trimmedReply);

      return trimmedReply;
    } catch (error) {
      this.logger.error(`Gemini API lỗi: ${error.message}`);
      if (error.response) {
        this.logger.error(`Chi tiết: ${JSON.stringify(error.response.data)}`);
      }
      throw new BadRequestException('Trợ lý AI đang gặp sự cố, vui lòng thử lại sau');
    }
  }
}