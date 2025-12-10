# CountPadi

A full-stack inventory management system for restaurants built with Next.js, TypeScript, Tailwind CSS, and Supabase. Your friendly inventory management partner.

## Features

- **Opening Stock Tracking**: Record inventory at the start of each day
- **Closing Stock Tracking**: Record inventory at the end of each day
- **Sales/Usage Tracking**: Track items used during daily sales (e.g., Rice, Egusi & Fufu)
- **Admin Dashboard**: Monitor all activities, view opening/closing stocks, and sales for any date
- **Item Management**: Admins can add, edit, and delete inventory items
- **Role-Based Access**: Separate views for admin and staff members
- **Authentication**: Secure login/signup system

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Authentication + Row Level Security)
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd countpadi
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is ready, go to **Settings** → **API**
3. Copy your **Project URL** and **anon/public key**

### 3. Configure Environment Variables

1. Copy the example environment file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 4. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `supabase/schema.sql` from this project
3. Copy and paste the entire SQL script into the SQL Editor
4. Click **Run** to execute the schema

This will create:

- `profiles` table (extends auth.users)
- `items` table (inventory items)
- `opening_stock` table
- `closing_stock` table
- `sales` table
- Row Level Security (RLS) policies
- Triggers for automatic profile creation

### 5. Create Admin User

After running the schema, you need to create an admin user:

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **Add User** → **Create New User**
3. Enter email and password
4. After creating the user, go to **Table Editor** → **profiles**
5. Find your user and update the `role` field to `'admin'`

Alternatively, you can use SQL:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Staff Members

1. **Sign up** or **log in** with your credentials
2. On the dashboard, you can:
   - Record **Opening Stock** (start of day)
   - Record **Closing Stock** (end of day)
   - Record **Sales/Usage** (items used during sales)

### For Admin

1. **Log in** with admin credentials
2. Click **Admin View** in the navigation
3. View all activities by selecting a date
4. Manage inventory items in the **Manage Items** tab

## Project Structure

```
countpadi/
├── app/
│   ├── admin/          # Admin dashboard page
│   ├── dashboard/      # Staff dashboard page
│   ├── login/          # Login page
│   ├── signup/         # Signup page
│   └── layout.tsx      # Root layout
├── components/
│   ├── AdminDashboard.tsx      # Admin dashboard component
│   ├── DashboardLayout.tsx     # Shared layout component
│   ├── ItemManagement.tsx      # Item CRUD component
│   ├── DailyStockReport.tsx    # Opening/Closing stock reports
│   ├── RestockingForm.tsx      # Restocking form
│   └── SalesForm.tsx           # Sales form
├── lib/
│   └── supabase/
│       ├── client.ts   # Client-side Supabase client
│       └── server.ts   # Server-side Supabase client
├── supabase/
│   └── schema.sql      # Database schema
├── types/
│   └── database.ts     # TypeScript types
└── middleware.ts       # Auth middleware
```

## Database Schema

### Tables

- **profiles**: User profiles with roles (admin/staff)
- **items**: Inventory items (name, unit, description)
- **opening_stock**: Opening stock records (one per item per day)
- **closing_stock**: Closing stock records (one per item per day)
- **sales**: Sales/usage records (multiple per item per day)

### Security

- Row Level Security (RLS) is enabled on all tables
- Staff can view and insert records
- Admins have full access
- Only admins can manage items

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your hosting platform:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Support

For issues or questions, please check:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## License

MIT
