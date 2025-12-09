# Role-Based Permissions Guide

This document outlines what each role (Staff, Branch Manager, Admin) can and cannot do in the Zentro system.

---

## **STAFF** (`role: 'staff'`)

### ✅ **CAN DO:**

#### **Sales/Usage**
- ✅ Record sales for **today's date only**
- ✅ View sales records for their branch
- ❌ Cannot record sales for past dates
- ❌ Cannot edit or delete sales records
- ❌ Cannot change the date field (locked to today)

#### **Opening Stock**
- ✅ Record opening stock for **today's date only**
- ✅ View opening stock records for their branch
- ❌ Cannot record opening stock for past dates
- ❌ Cannot edit or delete opening stock records

#### **Restocking**
- ❌ **Cannot record restocking** (restricted to managers and admins only)
- ✅ View restocking records for their branch
- ❌ Cannot edit or delete restocking records

#### **Closing Stock**
- ✅ Record closing stock
- ✅ View closing stock records for their branch
- ❌ Cannot edit or delete closing stock records

#### **Waste/Spoilage**
- ✅ Record waste/spoilage for **today's date only**
- ✅ View waste/spoilage records for their branch
- ✅ Edit/delete waste/spoilage records **only for today**
- ❌ Cannot record waste/spoilage for past dates
- ❌ Cannot edit/delete past waste/spoilage records

#### **Expenses**
- ✅ Record expenses
- ✅ View expenses for their branch
- ✅ Edit/delete their own expenses
- ❌ Cannot edit/delete other users' expenses

#### **Viewing & Reports**
- ✅ View dashboard with stats for their branch
- ✅ View sales reports
- ✅ View history
- ✅ View inventory valuation
- ✅ View profit/loss reports
- ✅ View recipes
- ✅ View menu

#### **Items**
- ✅ View items in their organization
- ❌ Cannot create, edit, or delete items

#### **User Management**
- ❌ Cannot access user management page
- ❌ Cannot create, edit, or delete users

#### **Branches**
- ❌ Cannot create, edit, or delete branches
- ❌ Cannot switch branches (locked to assigned branch)

#### **Transfers**
- ❌ Cannot create or manage transfers

---

## **BRANCH MANAGER** (`role: 'branch_manager'`)

### ✅ **CAN DO:**

#### **Sales/Usage**
- ✅ Record sales for **today's date only**
- ✅ View sales records for their branch
- ❌ Cannot record sales for past dates
- ❌ Cannot edit or delete sales records
- ❌ Cannot change the date field (locked to today)

#### **Opening Stock**
- ✅ Record opening stock for **today's date only**
- ✅ View opening stock records for their branch
- ❌ Cannot record opening stock for past dates
- ❌ Cannot edit or delete opening stock records

#### **Restocking**
- ✅ Record restocking for **today's date only**
- ✅ View restocking records for their branch
- ❌ Cannot record restocking for past dates
- ❌ Cannot edit or delete restocking records

#### **Closing Stock**
- ✅ Record closing stock
- ✅ View closing stock records for their branch
- ❌ Cannot edit or delete closing stock records

#### **Waste/Spoilage**
- ✅ Record waste/spoilage for **today's date only**
- ✅ View waste/spoilage records for their branch
- ✅ Edit/delete waste/spoilage records **only for today**
- ❌ Cannot record waste/spoilage for past dates
- ❌ Cannot edit/delete past waste/spoilage records

#### **Expenses**
- ✅ Record expenses
- ✅ View expenses for their branch
- ✅ Edit/delete their own expenses
- ❌ Cannot edit/delete other users' expenses

#### **Viewing & Reports**
- ✅ View dashboard with stats for their branch
- ✅ View sales reports
- ✅ View history
- ✅ View inventory valuation
- ✅ View profit/loss reports
- ✅ View recipes
- ✅ View menu

#### **Items**
- ✅ View items in their organization
- ❌ Cannot create, edit, or delete items

#### **User Management**
- ✅ View staff users in **their branch only**
- ✅ Create staff users for **their branch only**
- ✅ Update staff users in **their branch only**
- ✅ Delete staff users in **their branch only**
- ❌ Cannot manage admins or other branch managers
- ❌ Cannot see users from other branches

#### **Branches**
- ❌ Cannot create, edit, or delete branches
- ❌ Cannot switch branches (locked to assigned branch)

#### **Transfers**
- ❌ Cannot create or manage transfers

---

## **ADMIN** (`role: 'admin'` or `role: 'tenant_admin'`)

### ✅ **CAN DO (Full Access):**

#### **Sales/Usage**
- ✅ Record sales for **any date** (including past dates for backfilling)
- ✅ View sales records for all branches (if tenant admin) or their branch
- ✅ Edit sales records
- ✅ Delete sales records
- ✅ Can change date field (not locked)

#### **Opening Stock**
- ✅ Record opening stock for **any date** (including past dates)
- ✅ View opening stock records for all branches (if tenant admin) or their branch
- ✅ Edit opening stock records
- ✅ Delete opening stock records
- ✅ Can change date field (not locked)

#### **Restocking**
- ✅ Record restocking for **any date** (including past dates)
- ✅ View restocking records for all branches (if tenant admin) or their branch
- ✅ Edit restocking records
- ✅ Delete restocking records
- ✅ Can change date field (not locked)

#### **Closing Stock**
- ✅ Record closing stock
- ✅ View closing stock records for all branches (if tenant admin) or their branch
- ✅ Edit closing stock records
- ✅ Delete closing stock records

#### **Waste/Spoilage**
- ✅ Record waste/spoilage for **any date**
- ✅ View waste/spoilage records for all branches (if tenant admin) or their branch
- ✅ Edit/delete waste/spoilage records for any date

#### **Expenses**
- ✅ Record expenses
- ✅ View expenses for all branches (if tenant admin) or their branch
- ✅ Edit/delete any expenses

#### **Viewing & Reports**
- ✅ View dashboard with stats for all branches (if tenant admin) or their branch
- ✅ View sales reports for all branches (if tenant admin) or their branch
- ✅ View history for all branches (if tenant admin) or their branch
- ✅ View inventory valuation for all branches (if tenant admin) or their branch
- ✅ View profit/loss reports for all branches (if tenant admin) or their branch
- ✅ View recipes
- ✅ View menu

#### **Items**
- ✅ Create items
- ✅ Edit items
- ✅ Delete items
- ✅ View all items in their organization

#### **User Management**
- ✅ View all staff and branch managers in their organization (if tenant admin) or their branch
- ✅ Create users (staff, branch managers)
- ✅ Update user roles and assignments
- ✅ Delete users
- ✅ Assign users to branches
- ✅ Reset user passwords

#### **Branches**
- ✅ Create branches (tenant admin only)
- ✅ Edit branches (tenant admin only)
- ✅ Delete branches (tenant admin only)
- ✅ Switch between branches (tenant admin only - via branch selector)
- ❌ Branch managers with admin role: locked to their assigned branch

#### **Transfers**
- ✅ Create transfers between branches
- ✅ View transfers
- ✅ Manage transfers

---

## **SUPERADMIN** (`role: 'superadmin'`)

### ✅ **CAN DO:**
- ✅ Manage organizations
- ✅ View all organizations and branches
- ✅ Create/edit/delete organizations
- ✅ View all users across all organizations
- ❌ **Cannot record sales, restocking, opening stock, or any operational data**
- ❌ **Cannot access dashboard features** (redirected to `/admin`)

---

## **Key Restrictions Summary**

### **Date Restrictions:**
- **Staff & Branch Manager**: Can only record data for **today's date**
- **Admin**: Can record data for **any date** (including past dates for backfilling)

### **Edit/Delete Restrictions:**
- **Staff**: Cannot edit/delete sales, opening stock, restocking, or closing stock
- **Branch Manager**: Cannot edit/delete sales, opening stock, restocking, or closing stock
- **Admin**: Can edit/delete all records

### **Branch Access:**
- **Staff**: Locked to assigned branch (cannot switch)
- **Branch Manager**: Locked to assigned branch (cannot switch)
- **Tenant Admin** (admin without branch_id): Can access all branches, can switch branches
- **Branch Admin** (admin with branch_id): Locked to assigned branch

### **User Management:**
- **Staff**: No access
- **Branch Manager**: Can manage staff in their branch only
- **Admin**: Can manage all staff and branch managers in their organization/branch

---

## **API-Level Restrictions**

All restrictions are enforced at both:
1. **Frontend level** (UI disabled, validation messages)
2. **API level** (server-side validation and RLS policies)

This ensures security even if someone tries to bypass the frontend restrictions.

