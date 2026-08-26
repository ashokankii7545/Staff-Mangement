# 📋 Staff Attendance System

A modern, VPN-proof staff attendance application with **selfie-based check-in**, **live GPS verification**, and **real-time dashboard analytics**.

Built with React + Material UI + GraphQL + Node.js + MongoDB.

---

## ✨ Features

- 📸 **Selfie-Based Attendance** — Staff capture a live photo for clock-in/out
- 📍 **GPS Location Verification** — Hardware GPS with geofence boundary check
- 🛡️ **VPN/Proxy Detection** — 4-layer security (GPS accuracy + VPN API + WebRTC leak + timezone check)
- 📊 **Real-time Dashboard** — Live stats, attendance trends, and activity timeline
- 📅 **Attendance History** — Filterable data grid with selfie previews and export
- 👥 **Staff Management** — Admin panel to manage employees and settings
- 🎨 **Material Design** — Clean, responsive UI inspired by Keka HR

---

## 🛠️ Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18 + Vite, Material UI v6, Apollo Client, Recharts |
| Backend | Node.js, Express, Apollo Server v4, GraphQL |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Camera | react-webcam |
| VPN Check | vpnapi.io + WebRTC |
| Geofencing | geolib (Haversine) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- A free API key from [vpnapi.io](https://vpnapi.io)

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
# Copy example env and fill in values
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/staff-attendance
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
VPNAPI_KEY=your-vpnapi-key
UPLOAD_DIR=uploads
```

### 3. Seed Default Data

```bash
cd server
npm run seed
```

This creates:
- **Admin account**: Employee ID `ADMIN001`, Password `admin123`
- **Default office settings**: Delhi coordinates, 200m geofence

### 4. Start Development

```bash
# Terminal 1 — Start backend
cd server
npm run dev

# Terminal 2 — Start frontend
cd client
npm run dev
```

- Frontend: http://localhost:5173
- GraphQL Playground: http://localhost:4000/graphql

---

## 📁 Project Structure

```
├── client/                     # React Frontend
│   └── src/
│       ├── features/           # Feature-based modules
│       │   ├── auth/           # Login, route protection
│       │   ├── attendance/     # Clock in/out, selfie, GPS
│       │   ├── dashboard/      # Stats, charts, activity
│       │   ├── history/        # Attendance records grid
│       │   └── admin/          # Staff mgmt, settings
│       ├── shared/             # Shared components
│       ├── hooks/              # Custom React hooks
│       ├── context/            # Auth context provider
│       ├── lib/                # Theme, Apollo config
│       └── graphql/            # Queries & mutations
│
├── server/                     # Node.js Backend
│   └── src/
│       ├── graphql/            # Schema & resolvers
│       ├── services/           # Business logic layer
│       ├── models/             # Mongoose schemas
│       ├── middleware/         # JWT auth
│       └── utils/              # Geofence, VPN, uploads
```

---

## 🔒 VPN Detection — 4-Layer Security

| Layer | Check | Purpose |
|:---|:---|:---|
| 1 | GPS Accuracy | Rejects IP-based fallback (accuracy > 150m) |
| 2 | vpnapi.io | Detects VPN, Proxy, TOR, Relay |
| 3 | WebRTC IP Leak | Compares browser IPs with request IP |
| 4 | Timezone Mismatch | Flags browser vs IP timezone discrepancy |

---

## 📄 License

MIT
