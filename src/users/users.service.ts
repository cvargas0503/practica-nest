import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly campos = {
    id: true, email: true, name: true, telephone: true,
    role: true, tenantId: true, createdAt: true, updatedAt: true,
  } satisfies Prisma.UserSelect;

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: { ...createUserDto, password: await hash(createUserDto.password, 12) },
        select: this.campos,
      });
    } catch (error) { this.traducirError(error); }
  }

  findAll() {
    return this.prisma.user.findMany({ select: this.campos, orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: this.campos });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const data = { ...updateUserDto };
    if (data.password) data.password = await hash(data.password, 12);
    try {
      return await this.prisma.user.update({ where: { id }, data, select: this.campos });
    } catch (error) { this.traducirError(error); }
  }

  async remove(id: number) {
    try {
      return await this.prisma.user.delete({ where: { id }, select: this.campos });
    } catch (error) { this.traducirError(error); }
  }

  private traducirError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('El correo ya está registrado');
      if (error.code === 'P2003') throw new BadRequestException('El tenant no existe');
      if (error.code === 'P2025') throw new NotFoundException('Usuario no encontrado');
    }
    throw error;
  }
}
