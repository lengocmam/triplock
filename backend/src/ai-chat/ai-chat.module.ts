import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight } from '../flights/entities/flight.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Flight, Booking, ChatMessage])],
  providers: [AiChatService],
  controllers: [AiChatController],
})
export class AiChatModule {}