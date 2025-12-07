# How to Add New Items to the System

## Overview
This guide explains the proper way to add new items to your inventory system. The system automatically handles organization assignment, so you just need to follow these steps.

## Step-by-Step Guide

### Step 1: Navigate to Item Management
1. Go to **Management** in the sidebar (Admin only)
2. Click on **Items** tab (if not already selected)

### Step 2: Create the New Item
1. Click the **"Add New Item"** or **"Create Item"** button
2. Fill in the form with the following information:

   **Required Fields:**
   - **Item Name**: Enter the name (e.g., "Fufu", "Rice", "Chicken")
   - **Unit**: Select the unit of measurement (pieces, kg, liters, etc.)
   - **Low Stock Threshold**: Set when you want to be alerted (default: 10)
   - **Initial Quantity**: Enter 0 (this is just for initial setup)

   **Optional Fields:**
   - **Default Cost Price**: Enter the cost price if known (can be updated later)
   - **Default Selling Price**: Enter the selling price if known (can be updated later)
   - **Description**: Any additional notes about the item

3. Click **"Save"** or **"Create Item"**

### Step 3: Restock the Item (IMPORTANT!)
After creating the item, you **MUST** restock it to make it available for sales:

1. Go to **Restocking** in the sidebar
2. Select the date (usually today's date)
3. Select your newly created item from the dropdown
4. Enter the **Quantity to Add**
5. Enter **Cost Price** and **Selling Price** (if not set during creation)
6. Click **"Record Restocking"**

**What happens automatically:**
- The system will create an opening stock record (with quantity 0) for that date
- The restocking quantity will be added
- The item will now appear in Sales/Usage with the correct available stock

### Step 4: Verify the Item
1. Go to **Sales/Usage** in the sidebar
2. Check that your new item appears in the dropdown
3. Verify the available stock shows correctly

## Important Notes

### Organization Assignment
- **Automatic**: The system automatically assigns items to your organization
- **No manual setup needed**: The database trigger handles this automatically
- **Multi-tenant safe**: Each organization only sees their own items

### Stock Management
- **Initial Quantity**: The "Initial Quantity" field is only for setup. Actual stock is managed through:
  - **Opening Stock**: Stock at the start of each day
  - **Restocking**: Additional stock added during the day
  - **Sales**: Stock used/sold
  - **Closing Stock**: Stock at the end of the day

### Price Management
- **Default Prices**: Set during item creation or restocking
- **Price Updates**: Update prices when restocking (weighted average is calculated)
- **Daily Prices**: Opening stock can have different prices per day for historical accuracy

## Troubleshooting

### Item Not Showing in Sales/Usage?
1. **Check if item was restocked**: New items must be restocked to appear
2. **Check the date**: Make sure you're looking at the correct date
3. **Click "Refresh Items List"**: Use the refresh button below the item dropdown
4. **Check browser console**: Open Developer Tools (F12) and check for errors

### Item Shows 0 Available Stock?
1. **Restock the item**: Go to Restocking and add quantity
2. **Check opening stock**: Go to Opening Stock page and verify the record exists
3. **Check date**: Make sure you're looking at the correct date

### Organization Issues?
- If items aren't showing, check that you're logged in with the correct organization
- Superadmins can see all items, but regular admins only see their organization's items

## Best Practices

1. **Create items first**: Always create the item before restocking
2. **Restock immediately**: Restock new items right after creation
3. **Set prices during restocking**: This ensures accurate price tracking
4. **Use consistent naming**: Use the same naming convention (e.g., "Fufu" not "fufu" or "FUFU")
5. **Set low stock threshold**: Helps with inventory management

## Example Workflow

1. **Create Item**: "Fufu" with unit "pieces", initial quantity 0
2. **Restock**: Add 10 pieces at ₦200 cost, ₦300 selling price
3. **Verify**: Check Sales/Usage - should show "Fufu (pieces) - Available: 10 (Opening Stock: 0, Restocked: 10)"
4. **Record Sales**: Now you can record sales of Fufu

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify your organization is correctly assigned
3. Ensure the database triggers are running (contact support if needed)
4. Try refreshing the page and clearing browser cache

