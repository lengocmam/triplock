import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_feedbacks')
export class ChatFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => ChatMessage, { onDelete: 'CASCADE' })
  message!: ChatMessage;

  @Column()
  isPositive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}