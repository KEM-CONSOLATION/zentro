-- ============================================================================
-- DELETE ITEMS FOR SPECIFIC ORGANIZATION AND BRANCH
-- ============================================================================
-- Organization ID: 4d2ca4cc-7d41-423d-a973-d76a615f82c3
-- Branch ID: d579cd78-bee5-4fe0-80cb-ce2472974d82
-- ============================================================================
-- WARNING: This will permanently delete all items and related records!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: PREVIEW - See what will be deleted
-- ============================================================================

DO $$
DECLARE
  org_id UUID := '4d2ca4cc-7d41-423d-a973-d76a615f82c3';
  target_branch_id UUID := 'd579cd78-bee5-4fe0-80cb-ce2472974d82';
  item_count INTEGER;
  opening_stock_count INTEGER;
  closing_stock_count INTEGER;
  sales_count INTEGER;
  restocking_count INTEGER;
  waste_spoilage_count INTEGER;
  transfers_count INTEGER;
  org_name TEXT;
BEGIN
  -- Get organization name
  SELECT name INTO org_name
  FROM public.organizations
  WHERE id = org_id;

  IF org_name IS NULL THEN
    RAISE EXCEPTION 'Organization with ID % not found', org_id;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organization: % (ID: %)', org_name, org_id;
  RAISE NOTICE 'Branch ID: %', target_branch_id;
  RAISE NOTICE '========================================';
  
  -- Count items (filtered by organization and optionally branch)
  SELECT COUNT(*) INTO item_count
  FROM public.items i
  WHERE i.organization_id = org_id
    AND (i.branch_id IS NULL OR i.branch_id = target_branch_id);
  
  -- Count related records
  SELECT COUNT(*) INTO opening_stock_count
  FROM public.opening_stock os
  INNER JOIN public.items i ON os.item_id = i.id
  WHERE i.organization_id = org_id
    AND (os.branch_id = target_branch_id OR os.branch_id IS NULL);
  
  SELECT COUNT(*) INTO closing_stock_count
  FROM public.closing_stock cs
  INNER JOIN public.items i ON cs.item_id = i.id
  WHERE i.organization_id = org_id
    AND (cs.branch_id = target_branch_id OR cs.branch_id IS NULL);
  
  SELECT COUNT(*) INTO sales_count
  FROM public.sales s
  INNER JOIN public.items i ON s.item_id = i.id
  WHERE i.organization_id = org_id
    AND (s.branch_id = target_branch_id OR s.branch_id IS NULL);
  
  SELECT COUNT(*) INTO restocking_count
  FROM public.restocking r
  INNER JOIN public.items i ON r.item_id = i.id
  WHERE i.organization_id = org_id
    AND (r.branch_id = target_branch_id OR r.branch_id IS NULL);

  SELECT COUNT(*) INTO waste_spoilage_count
  FROM public.waste_spoilage ws
  INNER JOIN public.items i ON ws.item_id = i.id
  WHERE i.organization_id = org_id
    AND (ws.branch_id = target_branch_id OR ws.branch_id IS NULL);

  SELECT COUNT(*) INTO transfers_count
  FROM public.branch_transfers bt
  INNER JOIN public.items i ON bt.item_id = i.id
  WHERE i.organization_id = org_id
    AND (bt.from_branch_id = target_branch_id OR bt.to_branch_id = target_branch_id);
  
  RAISE NOTICE 'PREVIEW - Records to be deleted:';
  RAISE NOTICE '  Items: %', item_count;
  RAISE NOTICE '  Opening Stock records: %', opening_stock_count;
  RAISE NOTICE '  Closing Stock records: %', closing_stock_count;
  RAISE NOTICE '  Sales records: %', sales_count;
  RAISE NOTICE '  Restocking records: %', restocking_count;
  RAISE NOTICE '  Waste/Spoilage records: %', waste_spoilage_count;
  RAISE NOTICE '  Branch Transfers: %', transfers_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 2: SHOW ITEMS THAT WILL BE DELETED
-- ============================================================================

SELECT 
  i.id,
  i.name,
  i.unit,
  i.quantity,
  i.branch_id,
  COUNT(DISTINCT os.id) as opening_stock_records,
  COUNT(DISTINCT cs.id) as closing_stock_records,
  COUNT(DISTINCT s.id) as sales_records,
  COUNT(DISTINCT r.id) as restocking_records
FROM public.items i
LEFT JOIN public.opening_stock os ON os.item_id = i.id 
  AND (os.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR os.branch_id IS NULL)
LEFT JOIN public.closing_stock cs ON cs.item_id = i.id 
  AND (cs.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR cs.branch_id IS NULL)
LEFT JOIN public.sales s ON s.item_id = i.id 
  AND (s.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR s.branch_id IS NULL)
LEFT JOIN public.restocking r ON r.item_id = i.id 
  AND (r.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR r.branch_id IS NULL)
WHERE i.organization_id = '4d2ca4cc-7d41-423d-a973-d76a615f82c3'
  AND (i.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR i.branch_id IS NULL)
GROUP BY i.id, i.name, i.unit, i.quantity, i.branch_id
ORDER BY i.name;

-- ============================================================================
-- STEP 3: DELETE ALL RELATED RECORDS AND ITEMS
-- ============================================================================
-- UNCOMMENT THE FOLLOWING TO EXECUTE THE DELETION:


DO $$
DECLARE
  org_id UUID := '4d2ca4cc-7d41-423d-a973-d76a615f82c3';
  target_branch_id UUID := 'd579cd78-bee5-4fe0-80cb-ce2472974d82';
  deleted_sales INT := 0;
  deleted_restocking INT := 0;
  deleted_waste_spoilage INT := 0;
  deleted_closing_stock INT := 0;
  deleted_opening_stock INT := 0;
  deleted_items INT := 0;
  deleted_transfers INT := 0;
  deleted_billing_charges INT := 0;
  org_name TEXT;
BEGIN
  -- Get organization name
  SELECT name INTO org_name
  FROM public.organizations
  WHERE id = org_id;

  IF org_name IS NULL THEN
    RAISE EXCEPTION 'Organization with ID % not found', org_id;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Deleting items for organization: %', org_name;
  RAISE NOTICE 'Branch ID: %', target_branch_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting deletion...';

  -- 1. Delete billing charges (if they reference items via sales)
  -- billing_charges references sales, not items directly, so we delete via sales
  -- Note: This will also be deleted automatically via CASCADE when sales are deleted,
  -- but we delete it first to get an accurate count
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_charges') THEN
    DELETE FROM public.billing_charges
    WHERE sale_id IN (
      SELECT s.id FROM public.sales s
      INNER JOIN public.items i ON s.item_id = i.id
      WHERE i.organization_id = org_id
        AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
        AND (s.branch_id = target_branch_id OR s.branch_id IS NULL)
    );
    GET DIAGNOSTICS deleted_billing_charges = ROW_COUNT;
    RAISE NOTICE 'Deleted % billing_charges records', deleted_billing_charges;
  END IF;

  -- 2. Delete branch transfers (both incoming and outgoing for this branch)
  DELETE FROM public.branch_transfers
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (branch_transfers.from_branch_id = target_branch_id OR branch_transfers.to_branch_id = target_branch_id);
  GET DIAGNOSTICS deleted_transfers = ROW_COUNT;
  RAISE NOTICE 'Deleted % branch_transfers records', deleted_transfers;

  -- 3. Delete sales records
  DELETE FROM public.sales
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (sales.branch_id = target_branch_id OR sales.branch_id IS NULL);
  GET DIAGNOSTICS deleted_sales = ROW_COUNT;
  RAISE NOTICE 'Deleted % sales records', deleted_sales;

  -- 4. Delete restocking records
  DELETE FROM public.restocking
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (restocking.branch_id = target_branch_id OR restocking.branch_id IS NULL);
  GET DIAGNOSTICS deleted_restocking = ROW_COUNT;
  RAISE NOTICE 'Deleted % restocking records', deleted_restocking;

  -- 5. Delete waste/spoilage records
  DELETE FROM public.waste_spoilage
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (waste_spoilage.branch_id = target_branch_id OR waste_spoilage.branch_id IS NULL);
  GET DIAGNOSTICS deleted_waste_spoilage = ROW_COUNT;
  RAISE NOTICE 'Deleted % waste_spoilage records', deleted_waste_spoilage;

  -- 6. Delete closing_stock records
  DELETE FROM public.closing_stock
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (closing_stock.branch_id = target_branch_id OR closing_stock.branch_id IS NULL);
  GET DIAGNOSTICS deleted_closing_stock = ROW_COUNT;
  RAISE NOTICE 'Deleted % closing_stock records', deleted_closing_stock;

  -- 7. Delete opening_stock records
  DELETE FROM public.opening_stock
  WHERE item_id IN (
    SELECT id FROM public.items i
    WHERE i.organization_id = org_id
      AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
  )
  AND (opening_stock.branch_id = target_branch_id OR opening_stock.branch_id IS NULL);
  GET DIAGNOSTICS deleted_opening_stock = ROW_COUNT;
  RAISE NOTICE 'Deleted % opening_stock records', deleted_opening_stock;

  -- 8. Delete recipe_ingredients if they exist
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
      DELETE FROM public.recipe_ingredients
      WHERE item_id IN (
        SELECT id FROM public.items i
        WHERE i.organization_id = org_id
          AND (i.branch_id IS NULL OR i.branch_id = target_branch_id)
      );
      RAISE NOTICE 'Deleted recipe_ingredients records (if any)';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not delete recipe_ingredients: %', SQLERRM;
  END;

  -- 9. Finally, delete the items themselves
  DELETE FROM public.items
  WHERE organization_id = org_id
    AND (items.branch_id IS NULL OR items.branch_id = target_branch_id);
  GET DIAGNOSTICS deleted_items = ROW_COUNT;
  RAISE NOTICE 'Deleted % items', deleted_items;

  RAISE NOTICE '========================================';
  RAISE NOTICE '--- Deletion Summary ---';
  RAISE NOTICE 'Items deleted: %', deleted_items;
  RAISE NOTICE 'Sales records deleted: %', deleted_sales;
  RAISE NOTICE 'Restocking records deleted: %', deleted_restocking;
  RAISE NOTICE 'Waste/Spoilage records deleted: %', deleted_waste_spoilage;
  RAISE NOTICE 'Closing stock records deleted: %', deleted_closing_stock;
  RAISE NOTICE 'Opening stock records deleted: %', deleted_opening_stock;
  RAISE NOTICE 'Branch transfers deleted: %', deleted_transfers;
  RAISE NOTICE 'Billing charges deleted: %', deleted_billing_charges;
  RAISE NOTICE '--- Deletion completed successfully! ---';
  RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error deleting items: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 4: VERIFY DELETION (Run after uncommenting step 3)
-- ============================================================================

/*
SELECT 
  COUNT(*) as remaining_items,
  o.name as organization_name
FROM public.items i
RIGHT JOIN public.organizations o ON i.organization_id = o.id
WHERE o.id = '4d2ca4cc-7d41-423d-a973-d76a615f82c3'
  AND (i.branch_id = 'd579cd78-bee5-4fe0-80cb-ce2472974d82' OR i.branch_id IS NULL)
GROUP BY o.name;
*/

COMMIT;

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this script to see a preview of what will be deleted
-- 2. Review the items list in STEP 2
-- 3. If you're sure, uncomment the DELETE block in STEP 3 (remove /* and */)
-- 4. Run the script again to execute the deletion
-- 5. Run the verification query in STEP 4 to confirm deletion
-- ============================================================================
