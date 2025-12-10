# User Role Permissions Summary

## Overview
This document outlines what each user role can see and access in CountPadi.

---

## 1. SUPERADMIN
**Access Level:** Platform-wide, all organizations

### Sidebar Navigation:
- ✅ Organizations (redirects to `/admin`)

### Dashboard:
- ❌ Cannot access regular dashboard (redirected to `/admin`)
- ✅ Super Admin View (manages all organizations)

### Can Access:
- ✅ All organizations management
- ✅ Create/edit/delete organizations
- ✅ View all users across all organizations
- ✅ Manage organization settings (business type, opening/closing times, branding)

### Cannot Access:
- ❌ Operational features (issuances, returns, stock management)
- ❌ Branch-specific operations

---

## 2. ADMIN / TENANT_ADMIN
**Access Level:** Organization-wide, all branches

### Sidebar Navigation:
- ✅ Dashboard
- ✅ Opening Stock
- ✅ Restocking
- ✅ Closing Stock
- ✅ Sales/Usage (manual sales entry)
- ✅ Issue Items
- ✅ Returns
- ✅ Reconciliation
- ✅ Staff Performance
- ✅ History
- ✅ Sales Reports
- ✅ Profit & Loss
- ✅ Transfers
- ✅ Expenses
- ✅ Waste/Spoilage
- ✅ Inventory Valuation
- ✅ Branches
- ✅ Management

### Dashboard Sections:
- ✅ Sales Stats Card
- ✅ Opening Stock Card
- ✅ Closing Stock Card
- ✅ Profit & Loss section
- ✅ Expenses section
- ✅ Low Stock Alerts
- ✅ Staff Sales Ranking
- ✅ Sales Trend Chart
- ✅ Top Items Chart

### Can Access:
- ✅ All features in their organization
- ✅ Create/manage branches
- ✅ Create users (staff, controller, branch_manager, admin)
- ✅ Switch between branches
- ✅ View all staff across all branches
- ✅ Manual sales entry
- ✅ Stock management (opening/closing)
- ✅ Financial reports (Profit & Loss)
- ✅ Inventory valuation

### Cannot Access:
- ❌ Other organizations (unless superadmin)

---

## 3. BRANCH_MANAGER
**Access Level:** Single branch within organization

### Sidebar Navigation:
- ✅ Dashboard
- ✅ Opening Stock
- ✅ Restocking
- ✅ Closing Stock
- ✅ Sales/Usage (manual sales entry)
- ✅ Issue Items
- ✅ Returns
- ✅ Reconciliation
- ✅ Staff Performance
- ✅ History
- ✅ Sales Reports
- ✅ Profit & Loss
- ✅ Transfers
- ✅ Expenses
- ✅ Waste/Spoilage
- ✅ Inventory Valuation
- ❌ Branches (cannot create/manage branches)
- ✅ Management (can create users for their branch)

### Dashboard Sections:
- ✅ Sales Stats Card
- ✅ Opening Stock Card
- ✅ Closing Stock Card
- ✅ Profit & Loss section
- ✅ Expenses section
- ✅ Low Stock Alerts
- ✅ Staff Sales Ranking
- ✅ Sales Trend Chart
- ✅ Top Items Chart

### Can Access:
- ✅ All operational features for their branch
- ✅ Create users (staff and controller only) for their branch
- ✅ View/manage staff in their branch only
- ✅ Manual sales entry
- ✅ Stock management (opening/closing) for their branch
- ✅ Financial reports (Profit & Loss) for their branch
- ✅ Issue items to staff
- ✅ Record returns
- ✅ View staff performance

### Cannot Access:
- ❌ Create/manage branches
- ❌ Create admin or branch_manager roles
- ❌ View users from other branches
- ❌ Switch branches
- ❌ Other organizations

---

## 4. CONTROLLER
**Access Level:** Single branch within organization

### Sidebar Navigation:
- ✅ Dashboard
- ❌ Opening Stock
- ❌ Restocking
- ❌ Closing Stock
- ❌ Sales/Usage (manual sales entry - use issuance workflow instead)
- ✅ Issue Items
- ✅ Returns
- ✅ Reconciliation
- ✅ Staff Performance
- ❌ History (check sidebar - may need update)
- ✅ Sales Reports
- ❌ Profit & Loss
- ❌ Transfers
- ✅ Expenses
- ✅ Waste/Spoilage
- ❌ Inventory Valuation
- ❌ Branches
- ❌ Management

### Dashboard Sections:
- ✅ Sales Stats Card
- ❌ Opening Stock Card
- ❌ Closing Stock Card
- ❌ Profit & Loss section
- ✅ Expenses section
- ✅ Low Stock Alerts
- ✅ Staff Sales Ranking
- ✅ Sales Trend Chart
- ✅ Top Items Chart

### Can Access:
- ✅ Issue items to staff
- ✅ Record returns from staff
- ✅ View reconciliation
- ✅ View staff performance
- ✅ View sales reports
- ✅ View expenses
- ✅ View waste/spoilage
- ✅ View low stock alerts

### Cannot Access:
- ❌ Opening/closing stock management
- ❌ Restocking
- ❌ Manual sales entry (use issuance workflow)
- ❌ Profit & Loss (financial data)
- ❌ Transfers
- ❌ Inventory valuation
- ❌ Branch management
- ❌ User management
- ❌ History (needs verification)

---

## 5. STAFF
**Access Level:** Single branch within organization

### Sidebar Navigation:
- ✅ Dashboard
- ❌ Opening Stock
- ❌ Restocking
- ❌ Closing Stock
- ❌ Sales/Usage
- ❌ Issue Items
- ❌ Returns
- ❌ Reconciliation
- ❌ Staff Performance
- ❌ History
- ❌ Sales Reports
- ❌ Profit & Loss
- ❌ Transfers
- ❌ Expenses
- ❌ Waste/Spoilage
- ❌ Inventory Valuation
- ❌ Branches
- ❌ Management
- ✅ My Issuances

### Dashboard Sections:
- ✅ Sales Stats Card
- ❌ Opening Stock Card
- ❌ Closing Stock Card
- ❌ Profit & Loss section
- ❌ Expenses section
- ❌ Low Stock Alerts
- ❌ Staff Sales Ranking
- ✅ Sales Trend Chart
- ✅ Top Items Chart

### Can Access:
- ✅ View their own issuances
- ✅ Confirm receipt of issued items (if they have smartphone)
- ✅ View their sales performance (from issuances)

### Cannot Access:
- ❌ All management features
- ❌ Stock management
- ❌ Sales entry
- ❌ Reports (except their own data)
- ❌ Financial data
- ❌ Issue items to others
- ❌ Record returns

---

## Summary Table

| Feature | Superadmin | Admin/Tenant Admin | Branch Manager | Controller | Staff |
|---------|-----------|-------------------|----------------|------------|-------|
| **Dashboard** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Opening Stock** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Closing Stock** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Restocking** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Sales/Usage (Manual)** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Issue Items** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Returns** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Reconciliation** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Staff Performance** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **My Issuances** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **History** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Sales Reports** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Profit & Loss** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Transfers** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Expenses** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Waste/Spoilage** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Inventory Valuation** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Branches** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Management** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create Users** | ✅ | ✅ | ✅ (staff/controller only) | ❌ | ❌ |
| **View All Branches** | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Notes

1. **Controller** role is designed for operational staff who issue items and record returns, but don't manage stock or financial data.

2. **Branch Manager** can create users but only for their branch and only staff/controller roles.

3. **Staff** role is the most restricted - they can only view their own issuances and confirm receipt.

4. **Admin/Tenant Admin** have full access to their organization across all branches.

5. **Superadmin** manages the platform and all organizations but doesn't access operational features.

