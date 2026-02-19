# HRMS Full Stack (Vite + Express + MongoDB Atlas)

## 1. Install Dependencies

From project root:

```bash
npm install
cd server
npm install
cd ..
```

## 2. Configure Environment

Create:

- `server/.env` from `server/.env.example`
- Optional root `.env` from `.env.example`

Required server variables:

- `MONGODB_URI` (MongoDB Atlas connection string)
- `JWT_SECRET`

## 3. Run Locally

Terminal A:

```bash
npm run server
```

Terminal B:

```bash
npm run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:5000`

## 4. Production Build

```bash
npm run build
npm run start
```

In production mode, backend serves static files from `dist/` if present.

## 5. Implemented API Coverage

- Auth: login, current user
- Profile: read/update + photo upload
- Attendance: checkin/checkout/status/history + break start/end
- Daily reports: submit + list
- Leaves: submit/list + approve/reject
- Chat: group/direct messages
- Team live status
- Announcements
- Holidays
- Admin users: list/create/update

