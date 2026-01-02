import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
@Index(['birthdayMonth', 'birthdayDay', 'timezone']) // Index for fast birthday lookups
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'email', length: 255, unique: true })
  email: string;

  @Column({ type: 'date' })
  birthday: Date;

  @Column({ name: 'birthday_month', type: 'int' })
  birthdayMonth: number;

  @Column({ name: 'birthday_day', type: 'int' })
  birthdayDay: number;

  @Column({ length: 100 })
  timezone: string; // e.g., 'America/New_York', 'Australia/Melbourne'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Get the user's full name
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
