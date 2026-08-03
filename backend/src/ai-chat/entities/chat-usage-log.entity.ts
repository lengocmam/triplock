import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('chat_usage_logs')
@Index(['user', 'createdAt'])
export class ChatUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Column()
  model!: string;

  @Column()
  promptTokens!: number;

  @Column()
  completionTokens!: number;

  @Column()
  totalTokens!: number;

  @Column()
  functionCallRounds!: number;

  @CreateDateColumn()
  createdAt!: Date;
}