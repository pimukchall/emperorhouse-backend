# EMP One Backend

REST API ของ Emperorhouse  
Stack: **Node.js (Express 5)** · **Prisma** · **MySQL** · **JWT** · **Multer** · **Nodemailer**

---

## 🚀 Quick Start

### 1) ติดตั้ง
```bash
npm install
```

### 2) ตั้งค่า Environment
ใช้สองไฟล์หลัก:
- `.env.development`
- `.env.production`

มีตัวอย่างที่ `.env.example` ให้ก็อปแล้วแก้ค่าได้ทันที

ค่าที่แนะนำให้มีอย่างน้อย:
```
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL="mysql://user:pass@localhost:3306/EMP_DB"

# App
API_PREFIX=api
AUTH_PREFIX=auth
FRONTEND_BASE_URL=http://localhost:3000

# JWT
JWT_ACCESS_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
ACCESS_TTL_SEC=900
REFRESH_TTL_SEC=604800

# Mail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM="EMP One" <no-reply@emperorhouse.com>
MAIL_TO="pimuk_ar@emperorhouse.com"

# Upload
UPLOAD_BASE_DIR=./uploads

# RBAC (สำหรับ MD)
EXEC_DEPT_CODES=MGT
```

> โปรดอย่าพุช `.env*` ขึ้น Git — ใช้ `.env.example` เป็นแม่แบบเท่านั้น

### 3) Prisma & DB
```bash
# Development
npm run db:generate:dev
npm run db:migrate:dev
npm run db:seed:dev     # ถ้ามี seed.js

# Production (deploy migration)
npm run db:generate:prod
npm run db:migrate:deploy
```

### 4) รันแอป
```bash
# Development
npm run dev   # ใช้ .env.development

# Production (local)
npm run start # ใช้ .env.production
```

---

## 📚 API Docs (Swagger)

- UI: **http://localhost:4000/api/docs**
- Spec (JSON): **http://localhost:4000/api/openapi.json**

ไฟล์สเปคอยู่ที่ `src/docs/openapi.json` (แก้/เพิ่ม endpoint ได้ตามจริง)

---

## 🔐 RBAC (บทบาทและสิทธิ์)

- **admin** — ทำได้ทุกอย่าง (read/write/delete/approve)
- **user** — เขียน/แก้ไขได้เฉพาะ **ของตนเอง**
- **manager** — เขียน/แก้ไขได้เฉพาะ **ทรัพยากรที่อยู่ในแผนกตน**
- **MD** — ต้องสังกัดแผนก **MGT**; **อ่าน+อนุมัติได้** ทั่วระบบ แต่ **ห้ามเขียน/ลบ**

บังคับใช้ผ่าน `middlewares/policy.js` และตัวช่วยจาก `utils/roles.js`:
- `requireAuth`, `requireMe`
- `canWriteUser`, `canWriteUserDepartment`, `canWriteEval`
- `anyOf(allowAdmin, allowMDApproveOnly)` สำหรับเส้นทางอนุมัติ

---

## 🧭 Base Routes

- Health: `GET /api/health`
- Auth: `/api/auth/*` (register, login, refresh, logout, me, change-password)
- Users: `/api/users/*`
- User Departments: `/api/user-departments/*`
- Departments: `/api/departments/*`
- Organizations: `/api/organizations/*`
- Roles: `/api/roles/*`
- Eval Cycles: `/api/eval-cycles/*`
- Evals: `/api/evals/*`
- Contacts: `/api/contacts/*`
- Files: `/api/files/*`
- Profile: `/api/profile/me`

> Prefix `/api` ถูกกำหนดด้วย `API_PREFIX` (ค่าเริ่มต้น `api`)

---

## 🗂 โครงสร้างโปรเจกต์

```
src/
  app.js
  server.js
  prisma.js
  config/
    env.js
  middlewares/
    auth.js
    upload.js
    validate.js
    policy.js
    error.js
  utils/
    roles.js
    pagination.js
    asyncHandler.js
    appError.js
  lib/
    tokens.js
    mailer.js
    score.js
    errors.js
    paths.js
    prisma-error.js
  controllers/
    *.controller.js
  services/
    *.service.js
  routes/
    *.routes.js
    index.js
  docs/
    openapi.json
prisma/
  schema.prisma
  seed.js
```

---

## 📦 NPM Scripts ที่ใช้บ่อย

```jsonc
"scripts": {
  "dev": "dotenv -e .env.development -- nodemon src/server.js",
  "start": "dotenv -e .env.production  -- node src/server.js",

  "prisma:init": "prisma init",
  "prisma:studio:dev":  "dotenv -e .env.development -- prisma studio",
  "prisma:studio:prod": "dotenv -e .env.production  -- prisma studio",

  "db:generate:dev":   "dotenv -e .env.development -- prisma generate",
  "db:generate:prod":  "dotenv -e .env.production  -- prisma generate",
  "db:migrate:dev":    "dotenv -e .env.development -- prisma migrate dev",
  "db:migrate:deploy": "dotenv -e .env.production  -- prisma migrate deploy",
  "db:push:dev":       "dotenv -e .env.development -- prisma db push",
  "db:reset:dev":      "dotenv -e .env.development -- prisma migrate reset --force",
  "db:seed:dev":       "dotenv -e .env.development -- node prisma/seed.js",
}
```

---

## 🧪 ตัวอย่าง cURL

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login   -H "Content-Type: application/json"   -d '{"email":"admin@emp.com","password":"secret"}'
```

### Get My Session
```bash
curl http://localhost:4000/api/auth/me   -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Create User (สิทธิขึ้นกับ RBAC)
```bash
curl -X POST http://localhost:4000/api/users   -H "Authorization: Bearer <ACCESS_TOKEN>"   -H "Content-Type: application/json"   -d '{"email":"u@emp.com","password":"1234","name":"U One","roleId":2}'
```

### Upload Avatar
```bash
curl -X POST http://localhost:4000/api/files/avatar   -H "Authorization: Bearer <ACCESS_TOKEN>"   -F "file=@./avatar.png"
```

---

## 🧯 Troubleshooting

- **`ReferenceError: path is not defined`**  
  เพิ่มใน `app.js`:
  ```js
  import path from "node:path";
  import fs from "node:fs";
  ```

- **Prisma ไม่พบ Client / schema เปลี่ยนแล้วไม่อัปเดต**  
  รัน:
  ```bash
  npm run db:generate:dev
  npm run db:migrate:dev
  ```

- **ไฟล์อัปโหลดใหญ่เกินไป**  
  ปรับ `limits.fileSize` ใน `middlewares/upload.js`

- **MD เขียน/ลบไม่ได้**  
  เป็นพฤติกรรมตาม RBAC — MD อ่าน+อนุมัติ (ผ่าน `allowMDApproveOnly`) เท่านั้น

---

## 📄 License
ISC
