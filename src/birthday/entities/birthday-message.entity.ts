import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MessageType } from '../../messages/message-type.enum';

export enum MessageStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
}

export { MessageType };

@Entity('birthday_messages')
@Unique(['userId', 'year']) // Prevent duplicate messages for same user/year
@Index(['status', 'scheduledFor'])
export class BirthdayMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  year: number; // The year of this birthday message

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.PENDING,
  })
  status: MessageStatus;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.BIRTHDAY,
  })
  messageType: MessageType;

  @Column({ name: 'scheduled_for', type: 'timestamp with time zone' })
  scheduledFor: Date; // When the message should be sent (9 AM in user's timezone)

  @Column({ name: 'sent_at', type: 'timestamp with time zone', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
