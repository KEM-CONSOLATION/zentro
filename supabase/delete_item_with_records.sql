-- SQL script to delete an item and all its related transaction records
-- This bypasses the application-level restriction for audit history preservation
-- Use with caution - this action cannot be undone

-- Option 1: Delete by item name (case-insensitive)
-- Replace 'Nkwobi' with the item name you want to delete
DO $$
DECLARE
    item_to_delete_id UUID;
    item_name_to_delete TEXT := 'Nkwobi'; -- CHANGE THIS to the item name
    deleted_sales INT := 0;
    deleted_restocking INT := 0;
    deleted_waste_spoilage INT := 0;
    deleted_closing_stock INT := 0;
    deleted_opening_stock INT := 0;
BEGIN
    -- Find the item ID by name (case-insensitive)
    SELECT id INTO item_to_delete_id
    FROM public.items
    WHERE LOWER(name) = LOWER(item_name_to_delete)
    LIMIT 1;

    IF item_to_delete_id IS NULL THEN
        RAISE EXCEPTION 'Item "%" not found. Nothing to delete.', item_name_to_delete;
    END IF;

    RAISE NOTICE 'Found item "%" with ID: %', item_name_to_delete, item_to_delete_id;
    RAISE NOTICE 'Starting deletion of all related records...';

    -- 1. Delete sales records
    DELETE FROM public.sales WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_sales = ROW_COUNT;
    RAISE NOTICE 'Deleted % sales records', deleted_sales;

    -- 2. Delete restocking records
    DELETE FROM public.restocking WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_restocking = ROW_COUNT;
    RAISE NOTICE 'Deleted % restocking records', deleted_restocking;

    -- 3. Delete waste/spoilage records
    DELETE FROM public.waste_spoilage WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_waste_spoilage = ROW_COUNT;
    RAISE NOTICE 'Deleted % waste/spoilage records', deleted_waste_spoilage;

    -- 4. Delete closing_stock records
    DELETE FROM public.closing_stock WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_closing_stock = ROW_COUNT;
    RAISE NOTICE 'Deleted % closing_stock records', deleted_closing_stock;

    -- 5. Delete opening_stock records
    DELETE FROM public.opening_stock WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_opening_stock = ROW_COUNT;
    RAISE NOTICE 'Deleted % opening_stock records', deleted_opening_stock;

    -- 6. Delete recipe_ingredients if they exist (if item is used in recipes)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
            DELETE FROM public.recipe_ingredients WHERE item_id = item_to_delete_id;
            RAISE NOTICE 'Deleted recipe_ingredients records (if any)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not delete recipe_ingredients: %', SQLERRM;
    END;

    -- 7. Finally, delete the item itself
    DELETE FROM public.items WHERE id = item_to_delete_id;
    RAISE NOTICE 'Deleted item "%" successfully', item_name_to_delete;

    RAISE NOTICE '--- Deletion Summary ---';
    RAISE NOTICE 'Item: %', item_name_to_delete;
    RAISE NOTICE 'Sales records deleted: %', deleted_sales;
    RAISE NOTICE 'Restocking records deleted: %', deleted_restocking;
    RAISE NOTICE 'Waste/Spoilage records deleted: %', deleted_waste_spoilage;
    RAISE NOTICE 'Closing stock records deleted: %', deleted_closing_stock;
    RAISE NOTICE 'Opening stock records deleted: %', deleted_opening_stock;
    RAISE NOTICE '--- Deletion completed successfully! ---';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting item: %', SQLERRM;
END $$;

-- ============================================
-- ALTERNATIVE: Delete by item ID
-- ============================================
-- Uncomment and use this section if you know the item ID instead of the name
-- Replace the UUID below with the actual item ID

/*
DO $$
DECLARE
    item_to_delete_id UUID := '00000000-0000-0000-0000-000000000000'; -- CHANGE THIS to the item ID
    deleted_sales INT := 0;
    deleted_restocking INT := 0;
    deleted_waste_spoilage INT := 0;
    deleted_closing_stock INT := 0;
    deleted_opening_stock INT := 0;
    item_name TEXT;
BEGIN
    -- Verify the item exists
    SELECT id, name INTO item_to_delete_id, item_name
    FROM public.items
    WHERE id = item_to_delete_id
    LIMIT 1;

    IF item_to_delete_id IS NULL THEN
        RAISE EXCEPTION 'Item with ID % not found. Nothing to delete.', item_to_delete_id;
    END IF;

    RAISE NOTICE 'Found item "%" with ID: %', item_name, item_to_delete_id;
    RAISE NOTICE 'Starting deletion of all related records...';

    -- 1. Delete sales records
    DELETE FROM public.sales WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_sales = ROW_COUNT;
    RAISE NOTICE 'Deleted % sales records', deleted_sales;

    -- 2. Delete restocking records
    DELETE FROM public.restocking WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_restocking = ROW_COUNT;
    RAISE NOTICE 'Deleted % restocking records', deleted_restocking;

    -- 3. Delete waste/spoilage records
    DELETE FROM public.waste_spoilage WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_waste_spoilage = ROW_COUNT;
    RAISE NOTICE 'Deleted % waste/spoilage records', deleted_waste_spoilage;

    -- 4. Delete closing_stock records
    DELETE FROM public.closing_stock WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_closing_stock = ROW_COUNT;
    RAISE NOTICE 'Deleted % closing_stock records', deleted_closing_stock;

    -- 5. Delete opening_stock records
    DELETE FROM public.opening_stock WHERE item_id = item_to_delete_id;
    GET DIAGNOSTICS deleted_opening_stock = ROW_COUNT;
    RAISE NOTICE 'Deleted % opening_stock records', deleted_opening_stock;

    -- 6. Delete recipe_ingredients if they exist
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
            DELETE FROM public.recipe_ingredients WHERE item_id = item_to_delete_id;
            RAISE NOTICE 'Deleted recipe_ingredients records (if any)';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not delete recipe_ingredients: %', SQLERRM;
    END;

    -- 7. Finally, delete the item itself
    DELETE FROM public.items WHERE id = item_to_delete_id;
    RAISE NOTICE 'Deleted item "%" successfully', item_name;

    RAISE NOTICE '--- Deletion Summary ---';
    RAISE NOTICE 'Item: %', item_name;
    RAISE NOTICE 'Sales records deleted: %', deleted_sales;
    RAISE NOTICE 'Restocking records deleted: %', deleted_restocking;
    RAISE NOTICE 'Waste/Spoilage records deleted: %', deleted_waste_spoilage;
    RAISE NOTICE 'Closing stock records deleted: %', deleted_closing_stock;
    RAISE NOTICE 'Opening stock records deleted: %', deleted_opening_stock;
    RAISE NOTICE '--- Deletion completed successfully! ---';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting item: %', SQLERRM;
END $$;
*/

-- ============================================
-- VERIFICATION QUERY (Run before deletion)
-- ============================================
-- Use this to check what will be deleted before running the deletion script
-- Replace 'Nkwobi' with the item name you want to check

/*
SELECT 
    'Item' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name

UNION ALL

SELECT 
    'Sales' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
JOIN public.sales s ON s.item_id = i.id
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name

UNION ALL

SELECT 
    'Restocking' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
JOIN public.restocking r ON r.item_id = i.id
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name

UNION ALL

SELECT 
    'Waste/Spoilage' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
JOIN public.waste_spoilage ws ON ws.item_id = i.id
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name

UNION ALL

SELECT 
    'Opening Stock' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
JOIN public.opening_stock os ON os.item_id = i.id
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name

UNION ALL

SELECT 
    'Closing Stock' as record_type,
    i.name as item_name,
    i.id as item_id,
    COUNT(*) as record_count
FROM public.items i
JOIN public.closing_stock cs ON cs.item_id = i.id
WHERE LOWER(i.name) = LOWER('Nkwobi') -- CHANGE THIS
GROUP BY i.id, i.name;
*/

