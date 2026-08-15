import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from '../flights/entities/flight.entity';
import { FareClass } from '../flights/entities/fare-class.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatUsageLog } from './entities/chat-usage-log.entity';
import { ChatFeedback } from './entities/chat-feedback.entity';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { KnowledgeBaseService } from './knowledge-base.service';

@Module({
  imports: [TypeOrmModule.forFeature([Flight, FareClass, Booking, ChatMessage, ChatUsageLog, ChatFeedback])],
  providers: [AiChatService, KnowledgeBaseService],
  controllers: [AiChatController],
  exports: [KnowledgeBaseService],
})
export class AiChatModule {}