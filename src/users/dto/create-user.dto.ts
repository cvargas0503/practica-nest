import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nuevo@practica.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Practica123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ example: 'Usuario de práctica' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '88880000' })
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  tenantId!: number;
}
