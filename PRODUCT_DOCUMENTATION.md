# StockWise - Restaurant Inventory Management System

## Product Overview

**StockWise** is a comprehensive, cloud-based inventory management system designed specifically for restaurants and food service businesses. It streamlines inventory tracking, sales management, financial reporting, and operational workflows, helping restaurant owners make data-driven decisions and reduce waste.

---

## Executive Summary

StockWise solves the critical pain points faced by restaurant owners who struggle with manual inventory tracking, inaccurate stock counts, poor visibility into profitability, and inefficient operational processes. Our multi-tenant SaaS platform provides real-time inventory visibility, automated calculations, comprehensive financial reporting, and role-based access control—all in one intuitive dashboard.

---

## Target Market

- **Primary**: Small to medium-sized restaurants (1-10 locations)
- **Secondary**: Food service businesses, cafes, catering companies
- **Geographic**: Global (currently optimized for Nigerian market with ₦ currency)

---

## Core Pain Points & Solutions

### 1. **Manual Inventory Tracking & Human Error**

**Pain Point:**
- Restaurants rely on paper logs or basic spreadsheets
- Manual calculations lead to errors
- No real-time visibility into stock levels
- Difficult to track inventory across multiple items

**Solution:**
- **Automated Stock Calculations**: Opening stock automatically becomes closing stock for the next day
- **Real-time Stock Tracking**: See available stock instantly when recording sales
- **Batch Management**: FIFO (First In, First Out) system ensures older stock is sold first
- **Historical Data**: Complete audit trail of all inventory movements

**Features:**
- Opening Stock Management
- Closing Stock Auto-calculation
- Restocking with Price Tracking
- Sales/Usage Recording with Stock Validation

---

### 2. **Price Change Management & Profitability Tracking**

**Pain Point:**
- When prices change, past records get affected incorrectly
- No way to track which batch was sold at which price
- Difficult to calculate accurate profit margins
- Price changes affect historical data incorrectly

**Solution:**
- **Price History Preservation**: Past prices remain unchanged when restocking with new prices
- **Batch-based Pricing**: Each restocking batch maintains its own price
- **FIFO Price Tracking**: Older stock (with older prices) is sold before newer stock
- **Next-Day Price Application**: Price changes only affect the next day's opening stock

**Features:**
- Batch Price Tracking
- Historical Price Preservation
- Profit & Loss Reporting with Accurate Cost Calculations
- Price Change Audit Trail

---

### 3. **Lack of Financial Visibility**

**Pain Point:**
- Restaurant owners don't know daily profitability
- No clear view of expenses vs. revenue
- Difficult to identify profitable vs. unprofitable items
- No automated financial reporting

**Solution:**
- **Real-time Profit & Loss**: See daily gross profit and net profit instantly
- **Expense Tracking**: Categorize and track all business expenses
- **Sales Analytics**: Visual charts showing sales trends and top-selling items
- **Balance Calculations**: Automatically calculate balance after expenses

**Features:**
- Profit & Loss Dashboard
- Expense Management
- Sales Reports & Analytics
- Financial Summary Cards

---

### 4. **Multi-Location & Multi-User Management**

**Pain Point:**
- Managing multiple restaurants requires separate systems
- No centralized view across locations
- Difficult to manage staff access and permissions
- No organization-level branding

**Solution:**
- **Multi-Tenant Architecture**: Each restaurant operates in complete isolation
- **Superadmin Dashboard**: Oversee all organizations from one place
- **Role-Based Access**: Admin, Staff, and Superadmin roles with appropriate permissions
- **Organization Branding**: Custom logos, colors, and names per organization

**Features:**
- Organization Management
- User Role Management (Admin, Staff, Superadmin)
- Organization-Specific Branding
- Data Isolation & Security

---

### 5. **Waste & Spoilage Tracking**

**Pain Point:**
- Food waste goes unrecorded
- No visibility into waste patterns
- Can't identify items with high spoilage rates
- Waste affects profitability but isn't tracked

**Solution:**
- **Waste/Spoilage Recording**: Track items that go bad or are wasted
- **Automatic Stock Deduction**: Waste automatically reduces available stock
- **Waste Analytics**: Identify patterns and reduce waste
- **Impact on Closing Stock**: Waste is factored into closing stock calculations

**Features:**
- Waste/Spoilage Form
- Waste Impact on Stock Calculations
- Historical Waste Tracking

---

### 6. **Recipe & Cost Management**

**Pain Point:**
- No way to track recipe costs
- Can't calculate dish profitability
- Difficult to manage ingredient relationships
- No recipe-based inventory planning

**Solution:**
- **Recipe Management**: Create recipes with multiple ingredients
- **Cost Calculation**: Automatically calculate recipe costs based on ingredient prices
- **Recipe-Based Inventory**: See which items are used in recipes
- **Menu Integration**: Link recipes to menu items

**Features:**
- Recipe Creation & Management
- Ingredient Tracking
- Recipe Cost Calculation
- Menu Item Association

---

### 7. **Data Accuracy & Audit Trail**

**Pain Point:**
- No way to verify who made changes
- Can't track when changes were made
- Difficult to correct errors
- No historical data for compliance

**Solution:**
- **Complete Audit Trail**: Every action is recorded with user and timestamp
- **Historical Data View**: View any date's inventory, sales, and stock levels
- **Past Date Editing**: Admins can correct past records
- **Cascading Updates**: Changes to past dates automatically update subsequent days

**Features:**
- History View (Date-based)
- Recorded By Tracking
- Timestamp on All Records
- Past Date Correction

---

### 8. **Low Stock Alerts & Inventory Planning**

**Pain Point:**
- Run out of items unexpectedly
- No warnings before stock runs low
- Can't plan restocking efficiently
- Reactive instead of proactive inventory management

**Solution:**
- **Low Stock Alerts**: Visual alerts for items running low
- **Dashboard Warnings**: See low stock items immediately on dashboard
- **Stock Availability Display**: Real-time stock levels when recording sales
- **Restocking Recommendations**: Based on sales patterns

**Features:**
- Low Stock Alerts Component
- Real-time Stock Availability
- Stock Validation Before Sales

---

## Key Features

### Inventory Management
- ✅ Opening Stock Tracking
- ✅ Closing Stock Auto-calculation
- ✅ Restocking Management
- ✅ Batch-based Inventory (FIFO)
- ✅ Multi-unit Support (kg, liters, pieces, etc.)

### Sales & Usage
- ✅ Sales Recording with Stock Validation
- ✅ Batch Selection (Opening Stock vs. Restocking)
- ✅ Payment Mode Tracking (Cash, Transfer)
- ✅ Sales History & Reports
- ✅ Real-time Stock Updates

### Financial Management
- ✅ Profit & Loss Reporting
- ✅ Expense Tracking & Categorization
- ✅ Balance Calculations
- ✅ Sales Analytics & Trends
- ✅ Top Items Analysis

### Reporting & Analytics
- ✅ Daily Stock Reports
- ✅ Sales Reports
- ✅ Profit & Loss Reports
- ✅ Historical Data View
- ✅ Date-based Filtering

### User & Organization Management
- ✅ Multi-tenant Architecture
- ✅ Role-Based Access Control
- ✅ User Management (Create, Edit, Delete)
- ✅ Organization Branding
- ✅ Superadmin Dashboard

### Additional Features
- ✅ Waste/Spoilage Tracking
- ✅ Recipe Management
- ✅ Low Stock Alerts
- ✅ Historical Data Correction
- ✅ Data Export Capabilities

---

## Technical Architecture

### Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Authentication + Row Level Security)
- **Date Handling**: date-fns
- **Deployment**: Netlify/Vercel ready

### Security Features
- Row Level Security (RLS) for data isolation
- Organization-level data segregation
- Role-based access control
- Secure authentication via Supabase Auth
- Foreign key constraints for data integrity

### Database Design
- Multi-tenant architecture with `organization_id` on all tables
- Unique constraints for data consistency
- Audit fields (`recorded_by`, `created_at`) on all transaction tables
- Cascading updates for stock calculations

---

## Competitive Advantages

1. **Price History Preservation**: Unlike competitors, we preserve historical prices when restocking, ensuring accurate profit calculations
2. **FIFO Batch Management**: Automatic batch selection ensures older stock is sold first
3. **Multi-Tenant Ready**: Built from the ground up for SaaS deployment
4. **Real-time Calculations**: All stock calculations happen in real-time
5. **Complete Audit Trail**: Every action is tracked and traceable
6. **Past Date Correction**: Admins can correct historical data with automatic cascading updates

---

## Use Cases

### Use Case 1: Daily Operations
**Scenario**: A restaurant owner needs to track daily inventory and sales.

**Workflow**:
1. Record opening stock in the morning
2. Record sales throughout the day
3. Record restocking when new items arrive
4. System automatically calculates closing stock
5. View profit & loss for the day

### Use Case 2: Price Change Management
**Scenario**: Rice price increases, but owner wants to sell old stock at old price first.

**Workflow**:
1. Restock rice with new price
2. System creates a new batch with new price
3. Old stock (with old price) is automatically selected first (FIFO)
4. New stock (with new price) is used after old stock is sold
5. Next day's opening stock uses the new price

### Use Case 3: Multi-Location Management
**Scenario**: A restaurant chain owner manages 5 locations.

**Workflow**:
1. Superadmin creates 5 organizations
2. Each location has its own admin
3. Superadmin can view metrics across all locations
4. Each location's data is completely isolated
5. Centralized oversight with decentralized operations

---

## Roadmap & Future Enhancements

See `FEATURE_ROADMAP.md` for detailed feature suggestions.

---

## Support & Documentation

- **Technical Documentation**: See `README.md`
- **Database Schema**: See `supabase/schema.sql`
- **API Documentation**: See individual route files in `app/api/`

---

## Contact & Sales

For inquiries about StockWise, please contact:
- **Product**: StockWise Inventory Management System
- **Version**: 1.0.0
- **License**: Proprietary

---

*Last Updated: December 2025*

