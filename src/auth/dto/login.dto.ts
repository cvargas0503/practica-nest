import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@practica.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Practica123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
