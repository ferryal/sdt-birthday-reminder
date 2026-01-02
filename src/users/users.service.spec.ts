import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: Partial<User> = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    birthday: new Date('1990-05-15'),
    birthdayMonth: 5,
    birthdayDay: 15,
    timezone: 'America/New_York',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      birthday: '1990-05-15',
      timezone: 'America/New_York',
    };

    it('should create a new user successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        birthday: expect.any(Date) as Date,
        birthdayMonth: 5,
        birthdayDay: 15,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      mockRepository.find.mockResolvedValue([mockUser as User]);

      const result = await service.findAll();

      expect(result).toEqual([mockUser]);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findOne(mockUser.id!);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateUserDto = {
      firstName: 'Jane',
    };

    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      mockRepository.findOne.mockResolvedValue(mockUser as User);
      mockRepository.save.mockResolvedValue(updatedUser as User);

      const result = await service.update(mockUser.id!, updateUserDto);

      expect(result.firstName).toBe('Jane');
    });

    it('should update birthday and recalculate month/day', async () => {
      const updateDtoWithBirthday = { birthday: '1991-12-25' };
      mockRepository.findOne.mockResolvedValue(mockUser as User);
      mockRepository.save.mockImplementation((user) => Promise.resolve(user));

      await service.update(mockUser.id!, updateDtoWithBirthday);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser as User);
      mockRepository.remove.mockResolvedValue(mockUser as User);

      await service.remove(mockUser.id!);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUsersWithBirthdayInTimezones', () => {
    it('should return empty array if no timezones provided', async () => {
      const result = await service.findUsersWithBirthdayInTimezones(5, 15, []);

      expect(result).toEqual([]);
    });

    it('should query users with matching birthday and timezone', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findUsersWithBirthdayInTimezones(5, 15, [
        'America/New_York',
      ]);

      expect(result).toEqual([mockUser]);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'user.birthdayMonth = :month',
        { month: 5 },
      );
    });
  });
});
