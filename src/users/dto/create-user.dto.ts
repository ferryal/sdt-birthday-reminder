import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John', description: 'First name of the user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: '1990-05-15',
    description: 'Birthday in ISO date format (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsNotEmpty()
  birthday: string; // ISO date string, e.g., '1990-05-15'

  @ApiProperty({
    example: 'Asia/Jakarta',
    description: 'IANA timezone (e.g., America/New_York, Asia/Jakarta)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, {
    message:
      'timezone must be a valid IANA timezone format (e.g., America/New_York)',
  })
  timezone: string; // IANA timezone, e.g., 'America/New_York'
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name of the user' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'john.doe@example.com',
    description: 'Email address',
  })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    example: '1990-05-15',
    description: 'Birthday in ISO date format',
  })
  @IsDateString()
  @IsOptional()
  birthday?: string;

  @ApiPropertyOptional({
    example: 'Asia/Jakarta',
    description: 'IANA timezone',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[A-Za-z_]+\/[A-Za-z_]+$/, {
    message:
      'timezone must be a valid IANA timezone format (e.g., America/New_York)',
  })
  timezone?: string;
}
