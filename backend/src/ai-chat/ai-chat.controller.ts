import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Ip } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { AiChatService } from './ai-chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller('ai-chat')
export class AiChatController {
  constructor(private aiChatService: AiChatService) {}

  // Chat: cho phép cả khách vãng lai lẫn user đã đăng nhập
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('message')
  async sendMessage(@Body() dto: ChatMessageDto, @Request() req: any, @Ip() ip: string): Promise<any> {
    const userId = req.user?.userId || null;
    return this.aiChatService.sendMessage(userId, dto.message, ip);
  }

  // Lịch sử, feedback: chỉ user đã đăng nhập mới có (cần định danh ổn định để lưu DB)
  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Request() req: any): Promise<any> {
    return this.aiChatService.getHistory(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('feedback/:messageId')
  submitFeedback(
    @Param('messageId') messageId: string,
    @Body('isPositive') isPositive: boolean,
    @Request() req: any,
  ): Promise<any> {
    return this.aiChatService.submitFeedback(req.user.userId, messageId, isPositive);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('history')
  clearHistory(@Request() req: any): Promise<any> {
    return this.aiChatService.clearHistory(req.user.userId);
  }
}