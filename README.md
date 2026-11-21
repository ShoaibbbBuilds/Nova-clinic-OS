# Nova Clinic OS

A modern clinic management system designed to bring everyday clinic operations into one organized workspace.

Nova Clinic OS provides a centralized dashboard for managing patients, appointments, doctors, billing, staff and clinic records. It uses role-based access, Supabase authentication and a responsive Next.js interface.

> **Project status:** Deployment preparation  
> **Repository:** [ShoaibbbBuilds/Nova-clinic-OS](https://github.com/ShoaibbbBuilds/Nova-clinic-OS)  
> **Frontend:** Next.js  
> **Database & Authentication:** Supabase  
> **Deployment target:** Vercel

---

## 1. Project Overview

Clinics often manage patient information, appointments, staff details and billing through separate systems or manual processes.

Nova Clinic OS aims to simplify these operations by bringing them together in one centralized application.

The system provides different workspaces for clinic administrators, receptionists and doctors. Each role receives access to the sections relevant to its responsibilities.

### Main objectives

- Centralize clinic operations.
- Organize patient records.
- Manage appointments and doctor information.
- Maintain billing and payment records.
- Manage clinic staff and their access.
- Provide a responsive dashboard across devices.
- Keep clinic information protected through authentication and database access policies.

## 2. Features and Modules

### Dashboard / Overview
- Clinic overview and statistics.
- Patient, appointment, doctor and payment counts.
- Quick navigation to important modules.
- User profile and account controls.
- Light and dark themes.

### Patient Management
- Patient directory.
- Patient information and records.
- Patient details and contact information.
- Clinic-scoped patient data.

### Appointment Management
- Centralized appointment workspace.
- Appointment records and scheduling workflow.
- Appointment information and status management.

### Doctor Management
- Doctor directory.
- Doctor information and records.
- Doctor management by clinic administrators.

### Billing Management
- Clinic billing workspace.
- Invoice and payment records.
- Billing-related information.

### Staff Management
- Staff directory.
- Staff invitations through email.
- Role assignment for doctors and receptionists.
- Account activation and deactivation.
- Clinic administrator access controls.

### Reports
- Clinic reporting workspace.
- Administrative reporting access.

### Settings
- Clinic settings workspace.
- Administrative settings access.

*Available actions and permissions are determined by the authenticated account, application logic and database policies.*

## 3. User Roles and Access

Nova Clinic OS supports three primary staff roles and a separate demo profile.

| Role | Description |
|---|---|
| Admin | Manages clinic operations and staff |
| Receptionist | Handles front-desk clinic workflows |
| Doctor | Accesses patient and appointment workflows |
| Demo | Provides a restricted demonstration experience |

### Admin

The administrator has access to:

- Overview
- Patients
- Appointments
- Doctors
- Billing
- Staff
- Reports
- Settings

### Receptionist

The receptionist workspace includes:

- Overview
- Patients
- Appointments
- Doctors
- Billing

### Doctor

The doctor workspace includes:

- Overview
- Patients
- Appointments

### Demo Account

The demo account provides a role-preview switcher inside the dashboard.

Available preview options:

- Admin
- Receptionist
- Doctor

**Important:** The preview switcher is for demonstration purposes. It changes the displayed workspace, not the authenticated user's actual database role or authorization privileges.

The demo account should not be used as a production clinic administrator account.

## 4. Demo Login Information

A shared demonstration account is configured for exploring Nova Clinic OS.

| Field | Value |
|---|---|
| Account | Nova Clinic Demo |
| Email | `nova.demo@particle-agency.com` |
| Profile type | Demo |
| Preview roles | Admin, Receptionist, Doctor |
| Login method | Email and password |

The password is intentionally not published in this repository. Share demo credentials separately with authorized reviewers.

### Actual staff accounts

Real clinic users should sign in using their own accounts.

Staff accounts are created through the administrator's Staff section using email invitations.

Supported staff roles:

- `admin`
- `receptionist`
- `doctor`

Staff members complete the invitation and authentication process using their own email addresses.

There are no shared production staff passwords.

## 5. Technology Stack

### Frontend

- Next.js 16
- React 19
- JavaScript
- Tailwind CSS 4

### Backend and data services

- Supabase PostgreSQL
- Supabase Authentication
- Supabase JavaScript SDK
- Supabase SSR integration
- Next.js Route Handlers

### Deployment

- Vercel — frontend hosting
- Supabase — database and authentication

### Optional backend

The repository also contains a separate Express.js server with a basic health-check endpoint.

It is not currently required by the main Next.js dashboard.

## 6. Project Structure

```text
Nova-clinic-OS/
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── reset-password/
│   │   │   ├── globals.css
│   │   │   └── layout.js
│   │   │
│   │   ├── lib/
│   │   │   └── supabase/
│   │   │
│   │   └── proxy.js
│   │
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   │   └── server.js
│   └── package.json
│
├── database/
│
├── .gitignore
└── README.md
```

### Important directories

- `frontend/src/app/dashboard/` — dashboard and its individual modules.
- `frontend/src/app/api/` — server-side API routes.
- `frontend/src/app/auth/` — authentication callback handling.
- `frontend/src/lib/supabase/` — Supabase browser and server clients.
- `backend/src/` — optional Express server.
- `database/` — reserved for database-related project resources.

## 7. Local Development Setup

### Prerequisites

Install:

- Node.js 20.9 or newer
- npm
- Git
- A Supabase project

### Step 1 — Clone the repository

```bash
git clone https://github.com/ShoaibbbBuilds/Nova-clinic-OS.git
```

```bash
cd Nova-clinic-OS
```

### Step 2 — Open the frontend directory

```bash
cd frontend
```

### Step 3 — Install dependencies

```bash
npm install
```

### Step 4 — Configure environment variables

Create a file named `.env.local` inside the `frontend` directory.

Add the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Replace the placeholder values with credentials from your own Supabase project.

**Security warning:** Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser-side code, public repositories or client-side environment variables. Keep `.env.local` out of Git.

### Step 5 — Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The application should now be available locally, provided the Supabase project and required database configuration are ready.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## 8. Supabase Configuration

Nova Clinic OS uses Supabase for authentication and persistent data storage.

The application expects a compatible database containing the following application tables:

- `clinics`
- `profiles`
- `doctors`
- `patients`
- `appointments`
- `consultations`
- `invoices`
- `payments`
- `invoice_items`

It also uses a private `staff_invitations` table and database functions for staff invitation workflows.

### Authentication

Supabase Authentication handles:

- Email and password login.
- User sessions.
- Password reset requests.
- Staff email invitations.
- Authentication callback handling.

### Database security

Application tables use Row Level Security (RLS).

Clinic-specific access must be enforced through database policies and server-side authorization checks.

The staff management API also uses a server-only Supabase service-role key for privileged administrative operations.

### Database setup note

The current repository does not include a complete, tracked baseline migration set or a ready-to-run database seed script.

A fresh installation therefore requires a compatible Supabase database schema, policies, functions and authentication configuration.

Do not assume that creating a new Supabase project and adding only the environment variables is sufficient.

For the existing deployment, use the already-configured Supabase project.

## 9. Deployment — Vercel

The recommended deployment architecture is:

- Next.js frontend hosted on Vercel.
- Supabase database and authentication hosted on Supabase.

### Vercel configuration

Import the GitHub repository:

`ShoaibbbBuilds/Nova-clinic-OS`

Configure the project as follows:

| Setting | Value |
|---|---|
| Framework | Next.js |
| Root Directory | `frontend` |
| Build Command | `next build` |
| Output Directory | Default |
| Install Command | Default |

### Environment variables

Add the following variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL
```

Set `NEXT_PUBLIC_SITE_URL` to the deployed application URL.

### Supabase redirect configuration

After deployment, configure the Supabase Authentication URL settings:

- Set the production site URL.
- Add the production authentication callback URL.
- Add the password-reset callback URL.
- Add localhost URLs for local development where required.

The production callback path is:

```text
/auth/callback
```

The password-reset flow returns to:

```text
/reset-password
```

After configuring the environment variables and authentication URLs, deploy the frontend through Vercel.

## 10. Optional Express Backend

The repository contains a small Express server.

To run it independently:

```bash
cd backend
npm install
npm run dev
```

The default port is `5000`.

Health-check endpoint:

```text
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Nova Clinic OS API is running"
}
```

This backend is currently separate from the main Next.js application and is not required for the standard Vercel deployment.

## 11. Security and Best Practices

- Never commit `.env.local` or production credentials.
- Never expose the Supabase service-role key.
- Use individual accounts for actual clinic staff.
- Do not share administrator credentials.
- Keep Row Level Security enabled.
- Enforce clinic-level data isolation.
- Verify authorization on server-side operations.
- Deactivate staff accounts when access is no longer required.
- Use secure authentication redirect URLs.
- Do not use real patient or medical information in public demonstrations.
- Review database policies and security advisories before production use.

## 12. Current Project Scope and Limitations

Nova Clinic OS is a clinic-management application, not a certified medical device or a clinical diagnostic system.

The application focuses on administrative and operational workflows.

The current repository also has some setup limitations:

- A complete database migration history is not included.
- The separate Express backend currently provides only a health-check endpoint.
- A fresh deployment requires the correct Supabase schema and configuration.
- Demo credentials are distributed separately from the source repository.

Before using the system with real clinic data, complete a security, privacy, backup, access-control and operational-readiness review.

## 13. Future Improvements

Potential areas for future development include:

- More advanced clinic analytics.
- Improved reporting and exports.
- Expanded appointment workflows.
- More comprehensive staff onboarding.
- Database migration and seed management.
- Automated backups and operational monitoring.
- Additional accessibility and usability improvements.

## 14. Contributing

For development or improvements:

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request with a clear description.

Keep changes focused and avoid committing secrets, credentials or private clinic information.

---

## License

No open-source license has been specified yet.

Unless a license is added to this repository, all rights remain with the copyright holder and reuse is not automatically granted.

---

**Nova Clinic OS**  
*One workspace. Better organized clinic operations.*
