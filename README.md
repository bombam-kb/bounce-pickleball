# Bounce Pickleball House 🏓

ระบบจองสนาม Pickleball — Mobile-First Responsive Web App (สร้างตาม SRS v1.1)

React 18 + Vite 6, pure CSS design system, mock data (ยังไม่มี backend)

> **Demo persistence:** ข้อมูลทั้งหมด (สนาม, การจอง, สมาชิก, แสตมป์, โปรโม, ตั้งค่า, session) บันทึกอัตโนมัติใน Local Storage key `bounce_demo_v1` — รีเซ็ตได้ที่ Admin → ตั้งค่า → "ล้างข้อมูล Demo ทั้งหมด" **สำหรับ demo เท่านั้น ห้ามเก็บข้อมูลจริง**

## Security (production-grade hardening ที่ทำแล้ว)

- `npm audit` = **0 vulnerabilities** (อัปเกรด Vite 5 → 6.4, esbuild patched)
- **Security headers** ใน `vercel.json`: CSP (script-src 'self' เท่านั้น), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP
- **CSV formula injection**: ทุก cell ที่ export ถูก neutralize prefix `= + - @` และ quote เสมอ
- **localStorage hardening**: JSON.parse ใน try/catch + ตรวจ shape ก่อนใช้ (ข้อมูลเสีย/ถูกแก้ → fallback เป็น seed)
- **Input caps**: maxLength ทุกช่องข้อความ, clamp ค่าติดลบในช่องตัวเลข
- ไม่มี `dangerouslySetInnerHTML` / `eval` / `innerHTML` — React escape ทุก output โดย default
- ⚠️ **ข้อจำกัดโดยธรรมชาติของ demo**: รหัส Admin (`bounce`) อยู่ฝั่ง client — เมื่อต่อ backend จริงต้องย้าย auth ไป server-side ทั้งหมด (JWT/session), Payment Gateway key ในหน้าตั้งค่าเป็น mock

## รันโปรเจค

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## 2 ฝั่งของแอป

| ฝั่ง | URL | หมายเหตุ |
|---|---|---|
| **ลูกค้า (จองสนาม)** | `/` | mobile-first, bottom nav |
| **Admin (พนักงาน)** | `/admin` | รหัสผ่าน demo: `bounce` |

## ฟีเจอร์ตาม SRS

**ฝั่งลูกค้า**
- Court Browser: ปฏิทิน 7 วันแบบ horizontal scroll + ตาราง Time Slot (ว่าง / จองแล้ว / ปิด / Peak)
- Fixed Booking: เลือกสนาม → วัน → เวลา → สรุป → Promo Code / Voucher → ชำระเงิน (QR PromptPay จำลอง ยืนยันอัตโนมัติใน 3 วิ) → Booking Reference
- Login จำลอง: LINE (ปุ่มเขียว) / Google / Email
- My Bookings: กำลังจะมาถึง / เสร็จสิ้น / ยกเลิก + ยกเลิกตาม policy
- My Membership: Stamp Card 10 ช่อง (ครบ 10 ออก Free Voucher อัตโนมัติ + คืนแสตมป์เมื่อยกเลิก), ระดับสมาชิก Bronze/Silver/Gold + progress bar, ประวัติแสตมป์
- สลับภาษา TH/EN ทุกหน้า

**ฝั่ง Admin** (`/admin`)
- Dashboard: ยอดจองวันนี้/สัปดาห์/เดือน, กราฟรายได้ 7 วัน, สถานะสนาม real-time, การจองที่กำลังมาถึง
- จัดการสนาม: เพิ่ม/แก้ไข/ลบ, ราคา Peak/Off-Peak, เวลาเปิด-ปิด, Block เวลาซ่อมบำรุง, Open Court toggle
- จัดการการจอง: ค้นหา/กรอง, ยกเลิกแทนลูกค้า, Export CSV
- Promo Codes: สร้างโค้ด (บาท/%), วันหมดอายุ, จำนวนครั้ง, สถิติการใช้, เปิด/ปิด
- สมาชิก: กรองตาม Tier/ช่องทาง, ปรับแสตมป์พร้อมเหตุผล, ออก Voucher manual, เพิ่ม Credits, Suspend, Export CSV, Action Log ทุกการแก้ไข
- ตั้งค่า: นโยบายยกเลิก, การแจ้งเตือน, ระยะเวลา Slot, อายุ Voucher, ภาษาเริ่มต้น, Payment Gateway Key

## โครงสร้าง

```
src/
├── App.jsx          # แยก 2 ฝั่งตาม path (/ กับ /admin)
├── store.jsx        # React Context: state + business logic ทั้งหมด
├── i18n.js          # dictionary TH/EN
├── index.css        # design system (Sporty Club: cream/pine/lime)
├── data/index.js    # mock data (วันที่ relative กับวันนี้เสมอ)
├── components/ui.jsx
├── user/            # UserApp, Home, Booking, MyBookings, Membership, Login
└── admin/           # AdminApp, Dashboard, Courts, Bookings, Promos, Members, Settings
```

## ขั้นต่อไป (ตาม Roadmap ใน SRS)

- ต่อ backend จริง + LINE LIFF / Google OAuth จริง
- Payment Gateway PromptPay จริง (ตอนนี้ mock ยืนยันอัตโนมัติ)
- LINE OA Notification, Email SMTP
- Open Court matching (โครง UI toggle มีแล้ว)
