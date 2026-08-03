import { IsString, MaxLength } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @MaxLength(500)
  message!: string;
}