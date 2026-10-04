import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { compare, hash } from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('API de usuarios y autenticación', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let carpeta: string;
  let idCreado: number;
  const correo = 'prueba@practica.local';
  const clave = 'Practica123!';
  const secret = 'secreto-exclusivo-de-las-pruebas-automatizadas';

  beforeAll(async () => {
    carpeta = mkdtempSync(join(tmpdir(), 'dsi-tests-'));
    const archivo = join(carpeta, 'test.db');
    new DatabaseSync(archivo).close();
    process.env.DATABASE_URL = `file:${archivo.replaceAll('\\', '/')}`;
    process.env.JWT_SECRET = secret;
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env: process.env });
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.tenant.create({ data: { id: 1, name: 'Tenant de prueba' } });
    await prisma.user.create({ data: { email: correo, password: await hash(clave, 4), tenantId: 1 } });
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    if (carpeta && resolve(carpeta).startsWith(resolve(tmpdir()) + sep) && basename(carpeta).startsWith('dsi-tests-')) {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it('responde en la ruta inicial', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });
  it('rechaza credenciales incorrectas', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: correo, password: 'Incorrecta123!' }).expect(401);
  });
  it('valida el DTO del login', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'inválido', password: 'abc' }).expect(400);
  });
  it('firma claims correctos y expira en una hora', async () => {
    const r = await request(app.getHttpServer()).post('/auth/login').send({ email: correo, password: clave }).expect(200);
    token = r.body.access_token as string;
    const claims = await new JwtService().verifyAsync<{ email: string; exp: number; iat: number }>(token, { secret });
    expect(claims.email).toBe(correo);
    expect(claims.exp - claims.iat).toBe(3600);
  });
  it('rechaza peticiones sin token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });
  it('rechaza tokens vencidos', async () => {
    const vencido = await new JwtService().signAsync({ sub: 1 }, { secret, expiresIn: -10 });
    await request(app.getHttpServer()).get('/users').auth(vencido, { type: 'bearer' }).expect(401);
  });
  it('rechaza firmas alteradas', async () => {
    await request(app.getHttpServer()).get('/users').auth(token + 'alterado', { type: 'bearer' }).expect(401);
  });
  it('consulta usuarios sin revelar contraseñas', async () => {
    const r = await request(app.getHttpServer()).get('/users').auth(token, { type: 'bearer' }).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).not.toHaveProperty('password');
  });
  it('crea un usuario con contraseña bcrypt', async () => {
    const r = await request(app.getHttpServer()).post('/users').auth(token, { type: 'bearer' })
      .send({ email: 'nuevo@practica.local', password: clave, name: 'Nuevo', tenantId: 1 }).expect(201);
    idCreado = r.body.id as number;
    expect(r.body).not.toHaveProperty('password');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: idCreado } });
    expect(u.password).not.toBe(clave);
    expect(await compare(clave, u.password)).toBe(true);
  });
  it('consulta el usuario por ID', async () => {
    const r = await request(app.getHttpServer()).get(`/users/${idCreado}`).auth(token, { type: 'bearer' }).expect(200);
    expect(r.body.email).toBe('nuevo@practica.local');
  });
  it('rechaza correos duplicados', async () => {
    await request(app.getHttpServer()).post('/users').auth(token, { type: 'bearer' })
      .send({ email: correo, password: clave, tenantId: 1 }).expect(409);
  });
  it('rechaza tenants inexistentes', async () => {
    await request(app.getHttpServer()).post('/users').auth(token, { type: 'bearer' })
      .send({ email: 'otro@practica.local', password: clave, tenantId: 999 }).expect(400);
  });
  it('rechaza DTO inválido y campos adicionales', async () => {
    await request(app.getHttpServer()).post('/users').auth(token, { type: 'bearer' })
      .send({ email: 'inválido', password: 'abc', tenantId: 0, campo: true }).expect(400);
  });
  it('actualiza nombre y contraseña y permite un nuevo login', async () => {
    const nuevaClave = 'Actualizada123!';
    const r = await request(app.getHttpServer()).patch(`/users/${idCreado}`).auth(token, { type: 'bearer' })
      .send({ name: 'Actualizado', password: nuevaClave }).expect(200);
    expect(r.body.name).toBe('Actualizado');
    expect(r.body).not.toHaveProperty('password');
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'nuevo@practica.local', password: nuevaClave }).expect(200);
  });
  it('rechaza IDs inválidos y usuarios inexistentes', async () => {
    await request(app.getHttpServer()).get('/users/abc').auth(token, { type: 'bearer' }).expect(400);
    await request(app.getHttpServer()).get('/users/999').auth(token, { type: 'bearer' }).expect(404);
  });
  it('elimina el usuario y confirma su ausencia', async () => {
    await request(app.getHttpServer()).delete(`/users/${idCreado}`).auth(token, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get(`/users/${idCreado}`).auth(token, { type: 'bearer' }).expect(404);
  });
});
