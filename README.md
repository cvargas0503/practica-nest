# Práctica NestJS, Prisma y JWT

Proyecto de las guías GD_S7_S1, GD_S7_S2 y GD_S8_S1_FinalNode.

## Requisitos

Node.js 24, npm, Nest CLI 11 y Prisma 6.19. SQLite funciona como base local.

## Preparación

```powershell
npm ci
$secretoJwt = node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
@("DATABASE_URL=file:./dev.db", "JWT_SECRET=$secretoJwt") | Set-Content -Encoding ascii .env
npx prisma generate
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('prisma/dev.db').close()"
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Swagger: http://localhost:3000/api
Prisma Studio: `npx prisma studio`

## Verificación

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Las pruebas de integración usan una base temporal independiente de `prisma/dev.db`.

## Entrega

Se trabaja en la rama `feat/guias-nestjs` con commits locales por funcionalidad.
Las evidencias y el reporte se almacenan fuera del repositorio. Las bases de datos,
los secretos, node_modules y dist están excluidos de Git.

## Autenticación

El seed crea tres tenants y seis usuarios. Para la demostración local:
`admin@practica.local` / `Practica123!`.

Enviar estas credenciales a `POST /auth/login`, copiar `access_token` y usar
`Authorization: Bearer <token>` en todas las rutas `/users`.
En Swagger se introduce el token mediante `Authorize`. La sesión JWT dura una hora.

El rol forma parte del token; esta práctica implementa autenticación, sin reglas
de autorización por rol o aislamiento de consultas por tenant.
