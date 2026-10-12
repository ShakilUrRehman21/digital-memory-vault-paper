# Digital Memory Vault

> **Behavioral Intelligence Dashboard** — Every Decision. Every Outcome. Measured.

Not a journal. Not therapy. A precision analytics engine for founders and operators who want data on their decision-making patterns.

---

## Features

| Feature | Description |
|---|---|
| 📓 **Decision Log** | Log every major decision with context — confidence level, emotional state, risk assessment, and expected outcome |
| ✅ **Outcome Tracking** | Record what actually happened. Compare predictions against reality. Track success ratings over time |
| 📐 **Calibration Score** | Measure the gap between confidence and outcome. Identify systematic over- or under-confidence |
| 🎲 **Risk Calibration** | See how high-risk bets perform versus low-risk plays. Build an accurate model of your own risk tolerance |
| 🧠 **Emotional Bias Detection** | Detect emotion-driven decisions through state tracking and reflection keyword analysis |
| 📊 **Analytics Dashboard** | Scatter plots, heatmaps, trends, and distribution charts — a complete picture of your decision patterns |

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Auth**: Custom JWT (`jose`) + `bcryptjs` — no third-party auth provider
- **Database**: PostgreSQL via [`@neondatabase/serverless`](https://neon.tech/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **3D / Animations**: [Three.js](https://threejs.org/) + [GSAP](https://gsap.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Export**: [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- **Validation**: Zod

---

## Database Schema

```
users               — Email/password accounts with full name
decisions           — Core decision records with category, confidence, emotional state, risk level, and expected outcome
outcomes            — Actual results linked to a decision, with success rating, lessons learned, and reflection
decision_metrics    — Per-user snapshot scores: decision accuracy, risk calibration, emotional bias, confidence calibration
```

### Decision Categories
`career` · `finance` · `health` · `product` · `personal`

### Emotional States
`calm` · `stressed` · `excited` · `pressured` · `uncertain`

### Risk Levels
`low` · `medium` · `high`

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (e.g. [Neon](https://neon.tech/), Supabase, or local)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/digital-memory-vault.git
cd digital-memory-vault
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the root:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/digital_memory_vault

# JWT Secret (any long random string)
JWT_SECRET=your-super-secret-jwt-key
```

### 3. Set Up the Database

```bash
npx drizzle-kit push
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create your account.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit push` | Push schema to DB |
| `npx drizzle-kit studio` | Open Drizzle Studio |

---

## Project Structure

```
app/
├── page.tsx                  # Root — redirects authenticated users to /dashboard
├── layout.tsx                # Root layout
├── globals.css               # Global styles
├── auth/
│   ├── login/                # Login page
│   └── register/             # Registration page
├── dashboard/
│   └── page.tsx              # Main analytics dashboard
└── api/
    ├── auth/                 # Login / register / logout API routes
    ├── decisions/            # CRUD for decisions
    ├── analytics/            # Aggregated analytics endpoints
    └── export/               # PDF export endpoint

components/
├── LandingContent.tsx        # Full landing page UI
├── LandingDynamics.tsx       # Stacked scroll + footer animations
├── animations/               # GSAP / Three.js animation components
├── canvas/                   # Three.js canvas scenes
├── charts/                   # Recharts visualization components
└── dashboard/                # Dashboard UI components

lib/
├── auth/                     # JWT helpers (sign, verify)
└── db/
    ├── schema.ts             # Drizzle schema definitions
    └── index.ts              # Neon DB client export
```

---

## Auth Flow

Digital Memory Vault uses **custom JWT authentication** (no Clerk, Auth.js, or similar):

1. **Register** → password hashed with `bcryptjs` → user stored in DB → JWT issued
2. **Login** → credentials verified → JWT signed with `jose` → stored in `auth_token` httpOnly cookie
3. **Protected routes** → middleware reads `auth_token`, verifies JWT → redirects to `/auth/login` if invalid
4. **Logout** → cookie cleared server-side

