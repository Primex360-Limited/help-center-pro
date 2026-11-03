# Help Centre Pro - Developer Guide

Welcome to the Help Centre Pro project! This comprehensive guide provides everything you need to understand the system architecture, set up your development environment, and start building features.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Development Environment Setup](#development-environment-setup)
4. [Project Structure](#project-structure)
5. [Access Points & Credentials](#access-points--credentials)
6. [Authentication & Security](#authentication--security)
7. [API Documentation](#api-documentation)
8. [Database Schema](#database-schema)
9. [Key Features & Modules](#key-features--modules)
10. [Recent Updates](#recent-updates)
11. [Development Best Practices](#development-best-practices)
12. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

Help Centre Pro is a modern, multi-tenant customer support platform featuring:
- **Ticket Management**: Email, live chat, phone, and manual ticket creation
- **Multi-tenancy**: Platform admin (provider) and tenant (workspace) scopes
- **Email Integration**: IMAP/SMTP two-way sync per agent, OAuth support (Gmail/Outlook)
- **VoIP Integration**: Browser-based softphone with SIP-over-WebSocket
- **Role-based Access Control**: Granular permissions system
- **Billing Integration**: Paystack for premium subscriptions

The platform follows a microservices-ready architecture with a monolith mode for development.

---

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js (Express.js)
- **Database**: PostgreSQL (Prisma ORM) - Primary identity layer
- **Legacy Database**: MongoDB - Certain collections (being phased out)
- **Authentication**: JWT (Access: 15min, Refresh: 7 days) with bcrypt
- **Email**: Resend API / SMTP (Nodemailer) for transactional emails
- **Real-time**: SIP-over-WebSocket for VoIP
- **Environment**: dotenv for configuration

### Frontend
- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.7
- **Routing**: React Router DOM 7.18.4
- **Icons**: Lucide React 1.54.0
- **Date Handling**: react-day-picker + date-fns
- **Internationalization**: i18next + react-i18next
- **VoIP**: JsSIP 3.13.9
- **Firebase**: Google Sign-in integration

---

## 🚀 Development Environment Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- (Optional) MongoDB for legacy features
- Git

### Step 1: Clone the Repository

```bash
git clone <repository_url>
cd Help_Center_Pro_webapp
```

### Step 2: Backend Setup

Navigate to the backend directory:

```bash
cd FUMS-HELP-CENTER-PRO-main/FUMS-HELP-CENTER-PRO-main
```

Install dependencies:

```bash
npm install
```

Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Variables](#environment-variables)).

Run database migrations:

```bash
npx prisma migrate dev --name init
```

Seed initial data (optional):

```bash
# The system auto-seeds a platform super admin if SEED_PROVIDER_SUPER_ADMIN=true
```

Start the backend server:

```bash
npm run dev
```

Backend runs on: `http://localhost:4008`

### Step 3: Frontend Setup

Navigate to the frontend directory:

```bash
cd ../../help-centre-pro-frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## 📁 Project Structure

```
Help_Center_Pro_webapp/
├── FUMS-HELP-CENTER-PRO-main/          # Backend
│   └── FUMS-HELP-CENTER-PRO-main/
│       ├── src/
│       │   ├── config/                 # Environment configuration
│       │   ├── database/
│       │   │   ├── prisma/             # Prisma schema & migrations
│       │   │   └── model/              # Legacy MongoDB models
│       │   ├── modules/                # Feature modules
│       │   │   ├── auth/               # Authentication service
│       │   │   ├── tickets/            # Ticket management
│       │   │   ├── email/              # Email integration
│       │   │   ├── workspace/          # Workspace settings
│       │   │   ├── platform/           # Platform admin features
│       │   │   ├── tenants/            # Tenant management
│       │   │   ├── users/              # User management
│       │   │   └── roles/              # Role & permissions
│       │   ├── shared/                 # Shared utilities
│       │   │   ├── constants/          # System constants
│       │   │   ├── errors/             # Custom error classes
│       │   │   └── utils/              # Helper functions
│       │   ├── middleware/             # Express middleware
│       │   └── app.js                  # Main application entry
│       ├── .env.example                # Environment template
│       └── package.json
│
└── help-centre-pro-frontend/           # Frontend
    ├── src/
    │   ├── api/                        # API client modules
    │   ├── components/                 # Reusable components
    │   │   ├── agents/                 # Agent-related components
    │   │   ├── tickets/                # Ticket components
    │   │   └── workspace/              # Workspace components
    │   ├── pages/                      # Page components
    │   │   ├── tickets/                # Ticket pages
    │   │   ├── auth/                   # Authentication pages
    │   │   ├── admin/                  # Admin portal pages
    │   │   └── workspace/              # Workspace pages
    │   ├── services/                   # Business logic services
    │   ├── styles/                     # CSS stylesheets
    │   ├── utils/                      # Frontend utilities
    │   └── App.jsx                     # Root component
    ├── package.json
    └── vite.config.js
```

---

## 🔑 Access Points & Credentials

### Local Development URLs

| Service | URL |
|---------|-----|
| **Tenant Login** | `http://localhost:5173/login` |
| **Admin Login** | `http://localhost:5173/admin/login` |
| **Backend API** | `http://localhost:4008` |
| **Swagger (External)** | `http://localhost:4008/api-docs` |
| **Swagger (Internal)** | `http://localhost:4008/api-docs/internal` |

### Production (Render) URLs

| Service | URL |
|---------|-----|
| **Backend API** | `https://helpcentre-pro-api.onrender.com` |
| **Tenant Frontend** | `https://helpcentre-pro-web.onrender.com` |
| **Admin Frontend** | `https://helpcentre-pro-admin.onrender.com` |
| **Swagger (Full)** | `https://helpcentre-pro-api.onrender.com/api-docs/internal` |

### Test Credentials

#### Local Development

**Admin Login (Platform Super Admin)**
- Email: `ebube.okechukwu@primex360.com`
- Password: `2020/EN/12566`

**User Login (Tenant)**
- Email: `jetsamjoseph@gmail.com`
- Password: `2020/EN/12566`

#### Render Production

**Account 1**
- Email: `ematrixebubejoseph@gmail.com`
- Password: `2020/EN/12566`

**Account 2**
- Email: `ebube.okechukwu@primex360.com`
- Password: `2020/En/12566`

**Account 3**
- Email: `ebubsebubs@gmail.com`
- Password: `2020/En/12566`

---

## 🔐 Authentication & Security

### Token Configuration

- **Access Token**: 15 minutes expiration
- **Refresh Token**: 7 days expiration (same for both tenant and platform admin)
- **Secret Keys**: Must be at least 32 characters long

### Environment Variables (Security)

```bash
# JWT Secrets (REQUIRED - min 32 chars)
JWT_ACCESS_SECRET=your_access_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_characters

# Token Expiration
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### User Types

- **PROVIDER**: Platform admin (tenantId is null)
- **TENANT**: Workspace user (has tenantId)

### Role System

- **Super Admin**: Platform operator (PROVIDER role)
- **Tenant Admin**: Workspace administrator
- **Agent**: Support agent with ticket access
- Custom roles with granular permissions

---

## 📚 API Documentation

### Swagger Documentation

**External Integration (Public)**
- URL: `http://localhost:4008/api-docs`
- Exposes: Public Widget + Health endpoints

**Full Internal API**
- URL: `http://localhost:4008/api-docs/internal`
- Protected by: `SWAGGER_INTERNAL_KEY` environment variable
- Exposes: Complete API surface

### Key API Endpoints

#### Authentication
- `POST /auth/register` - Register workspace account
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

#### Tickets
- `GET /tickets` - List tickets with filters
- `POST /tickets` - Create new ticket
- `PATCH /tickets/:id` - Update ticket
- `DELETE /tickets/:id` - Delete ticket

#### Users
- `GET /users` - List users
- `POST /users` - Create user
- `PATCH /users/:id` - Update user

#### Tenants
- `GET /tenants` - List tenants (platform admin only)
- `POST /tenants` - Create tenant (platform admin only)

---

## 🗄 Database Schema

### PostgreSQL (Primary)

The identity layer uses Prisma ORM with PostgreSQL. Key models:

- **User**: User accounts with role assignments
- **Tenant**: Workspaces/organizations
- **Role**: Role definitions with permissions
- **Permission**: Granular permissions
- **Ticket**: Support tickets
- **Customer**: Customer information
- **VerificationToken**: Email verification tokens

### MongoDB (Legacy)

Certain legacy collections still use MongoDB:
- Ticket history
- Email sync metadata
- Chat transcripts

---

## ✨ Key Features & Modules

### 1. Ticket Management
- Multi-channel support (Email, Chat, Phone, Manual)
- Status workflow (Open, Pending, Waiting, Queued, Resolved, Closed)
- Priority levels (High, Medium, Low)
- Bulk actions (resolve, close)
- Advanced filtering and search

### 2. Email Integration
- IMAP/SMTP two-way sync per agent
- OAuth support (Gmail, Outlook)
- Connected mailbox management
- Email encryption for stored credentials

### 3. VoIP Integration
- Browser-based softphone (JsSIP)
- SIP-over-WebSocket support
- Call recording and management
- Per-workspace SIP configuration

### 4. Multi-tenancy
- Platform admin (provider) scope
- Tenant (workspace) scope
- Workspace isolation
- Per-workspace branding

### 5. Role-based Access Control
- Granular permission system
- Custom role creation
- Permission inheritance
- Audit logging

### 6. Billing
- Paystack integration
- Premium subscription tiers
- Usage-based billing
- Billing ledger

---

## 🆕 Recent Updates

### Date Filter Enhancement (Latest)

**What Changed:**
- Replaced basic date inputs with a world-class date range picker
- Added period filter for quick selection (7 days, 1 month, 3 months, 6 months, 1 year)
- Improved UX with visual calendar and intuitive controls

**Components Added:**
- `DateRangePicker.jsx` - Custom date range picker with react-day-picker
- `PeriodFilter.jsx` - Quick period selection buttons

**Files Modified:**
- `src/pages/tickets/Tickets.jsx` - Updated to use new date components
- `src/styles/tickets.css` - Added styling for new components

**Dependencies Added:**
- `react-day-picker` - Modern date picker library
- `date-fns` - Date manipulation utilities

**Usage:**
```jsx
<DateRangePicker
  value={dateRange}
  onChange={(range) => setDateRange(range)}
/>
<PeriodFilter
  value={dateRange}
  onChange={(range) => setDateRange(range)}
/>
```

---

## 📝 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL_PRODUCTION=postgresql://user:password@localhost:5433/help_center_pro?schema=public
POSTGRES_REQUIRED=true

# JWT Secrets (MINIMUM 32 CHARACTERS)
JWT_ACCESS_SECRET=your_access_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_characters

# Frontend URLs
FRONTEND_URL=http://localhost:5173
ADMIN_FRONTEND_URL=http://localhost:5173
```

### Optional Variables

```bash
# Email Configuration
RESEND_API_KEY=your_resend_api_key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
EMAIL_FROM="HelpCentre Pro <noreply@helpcentrepro.com>"

# Email Encryption (SET ONCE - never change)
EMAIL_ENCRYPTION_KEY=your_long_random_string_32_plus_chars

# Email Sync
EMAIL_SYNC_INTERVAL=15000
EMAIL_SYNC_BATCH_SIZE=50

# OAuth (Gmail)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/settings/email/callback/gmail

# OAuth (Outlook)
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:5173/settings/email/callback/outlook

# Twilio (VoIP)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_API_KEY_SID=your_twilio_api_key_sid
TWILIO_API_KEY_SECRET=your_twilio_api_key_secret

# SIP Configuration
SIP_DEFAULT_WSS=wss://sip.example.com:8089/ws

# Redis (Optional)
REDIS_URL=redis://localhost:6379
REDIS_REQUIRED=false

# Firebase (Google Sign-in)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="your_firebase_private_key"

# Paystack (Billing)
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PREMIUM_PRICE_MONTHLY_USD=49

# Swagger Protection
SWAGGER_INTERNAL_KEY=your_long_random_string

# Seed Options
SEED_PROVIDER_SUPER_ADMIN=true
SEED_TEST_USER=false
SEED_DEMO_TICKETS=false
```

---

## 💡 Development Best Practices

### Code Style
- Follow existing code patterns in the codebase
- Use functional components with hooks
- Keep components small and focused
- Use descriptive variable and function names

### API Development
- Use async/await for asynchronous operations
- Implement proper error handling with try/catch
- Return consistent response formats
- Add input validation

### Database
- Use Prisma for database operations
- Run migrations before deploying
- Never modify schema directly in production
- Use transactions for multi-step operations

### Security
- Never commit secrets to version control
- Validate all user inputs
- Use parameterized queries (Prisma handles this)
- Implement rate limiting for public endpoints

### Testing
- Write unit tests for business logic
- Test authentication flows
- Verify permission checks
- Test edge cases

---

## 🔧 Troubleshooting

### Common Issues

**Issue: Database connection failed**
- Solution: Verify PostgreSQL is running and DATABASE_URL is correct

**Issue: JWT token errors**
- Solution: Ensure JWT secrets are at least 32 characters long

**Issue: Email not sending**
- Solution: Check SMTP_HOST is empty in local dev (logs to console)

**Issue: Frontend build fails**
- Solution: Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Issue: Prisma migration errors**
- Solution: Reset database: `npx prisma migrate reset`

**Issue: Permission denied errors**
- Solution: Check user roles and permissions in the database

### Getting Help

1. Check the logs in `logs-backend.out` and `logs-backend.err`
2. Review Swagger documentation for API details
3. Check environment variables are properly set
4. Verify database migrations are up to date

---

## 📞 Support

For questions or issues:
- Review this documentation
- Check the codebase comments
- Review Swagger API documentation
- Contact the development team

---

**Last Updated**: November 2026
**Version**: 1.0.0
