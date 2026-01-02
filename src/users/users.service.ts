import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Parse birthday to extract month and day for indexing
    const birthdayDate = new Date(createUserDto.birthday);
    const birthdayMonth = birthdayDate.getMonth() + 1; // getMonth() is 0-indexed
    const birthdayDay = birthdayDate.getDate();

    const user = this.userRepository.create({
      ...createUserDto,
      birthday: birthdayDate,
      birthdayMonth,
      birthdayDay,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`Created user: ${savedUser.id} - ${savedUser.email}`);

    return savedUser;
  }

  /**
   * Find all users
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Find a user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // If birthday is being updated, recalculate month and day
    if (updateUserDto.birthday) {
      const birthdayDate = new Date(updateUserDto.birthday);
      Object.assign(user, {
        ...updateUserDto,
        birthday: birthdayDate,
        birthdayMonth: birthdayDate.getMonth() + 1,
        birthdayDay: birthdayDate.getDate(),
      });
    } else {
      Object.assign(user, updateUserDto);
    }

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`Updated user: ${updatedUser.id}`);

    return updatedUser;
  }

  /**
   * Remove a user
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
    this.logger.log(`Deleted user: ${id}`);
  }

  /**
   * Find users with birthday on a specific month/day in given timezones
   * This is used by the birthday scheduler to find users to message
   */
  async findUsersWithBirthdayInTimezones(
    month: number,
    day: number,
    timezones: string[],
  ): Promise<User[]> {
    if (timezones.length === 0) {
      return [];
    }

    return this.userRepository
      .createQueryBuilder('user')
      .where('user.birthdayMonth = :month', { month })
      .andWhere('user.birthdayDay = :day', { day })
      .andWhere('user.timezone IN (:...timezones)', { timezones })
      .getMany();
  }
}
