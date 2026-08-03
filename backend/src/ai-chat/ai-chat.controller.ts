import { Controller, Get, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiChatService } from './ai-chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller('ai-chat')
@UseGuards(JwtAuthGuard)
export class AiChatController {
  constructor(private aiChatService: AiChatService) {}

  @Get('history')
  getHistory(@Request() req: any) {
    return this.aiChatService.getHistory(req.user.userId);
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('message')
  async sendMessage(@Body() dto: ChatMessageDto, @Request() req: any) {
    const reply = await this.aiChatService.sendMessage(req.user.userId, dto.message);
    return { reply };
  }

  @Delete('history')
  clearHistory(@Request() req: any) {
    return this.aiChatService.clearHistory(req.user.userId);
  }
}