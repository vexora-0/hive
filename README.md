# Hive

A secure photo sharing and memory preservation platform for preschools.

## About

Hive is a privacy-first platform that enables preschools to securely share classroom photos with parents. Teachers upload photos organized by class, and parents view a curated feed of images specific to their child. Parents can also order printed photos, frames, and albums — turning digital moments into lasting keepsakes.

## Features

- **OTP-based authentication** with role-based access (Admin, Teacher, Parent)
- **Teacher photo uploads** — multi-image upload organized by class
- **Parent photo feed** — child-specific, paginated image feed
- **Photo ordering** — parents can order prints, frames, and bundles
- **Admin dashboard** — manage schools, classes, students, teachers, and parents
- **Push notifications** — alerts for new uploads and order status updates
- **Secure storage** — signed URLs and role-based access control

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | Flutter |
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL (Supabase) |
| Object Storage | Supabase Storage / S3 |
| State Management | Provider / Riverpod |

## Project Structure

```
hive/
├── apps/
│   └── mobile/          # Flutter mobile app
│       └── lib/
│           ├── screens/ # App screens (admin, teacher, parent, auth)
│           ├── widgets/
│           ├── providers/ # State management
│           ├── models/  # Data models
│           └── services/ # API services
├── packages/
│   └── backend/         # Node.js + TypeScript API server
│       └── src/
│           ├── controllers/
│           ├── routes/
│           ├── services/
│           ├── middleware/
│           └── validators/
├── supabase/            # Database migrations and seed data
└── package.json         # pnpm monorepo root
```

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 9.x
- Flutter SDK
- Supabase project (for database and storage)

### Installation

```bash
# Install dependencies
pnpm install

# Start the backend
pnpm dev:backend

# Start the mobile app
pnpm dev:mobile
```

### Environment Variables

Create `.env` files in the respective packages with the required configuration (database URL, Supabase keys, storage credentials, etc.).

## Architecture

The system follows a client-server architecture with RESTful APIs and role-based access control:

1. **Mobile App** communicates with the backend over HTTPS
2. **Backend API** handles authentication, authorization, and business logic
3. **Supabase** provides the relational database and object storage
4. **CDN layer** optimizes image delivery to parents

## Team

- Bhargav M
- Ruthwik Chikoti
- Naga Chaitanya Varma
- Dharma Srujan Reddy

**Project Advisor:** Lakshya Jain

## License

This project is developed as part of an academic course (Group 145).
