# Proper Shipment Receive Workflow

## Problem
1. Warehouse admin can currently receive ANY product, not just shipments TO their warehouse
2. Movements tab shows ALL movements, not filtered by admin's warehouse

## Solution

### Backend Changes

#### [MODIFY] [movements.js](file:///Users/charanpreetsingh/modparts-ui/modparts-17dec/api/inventory/movements.js)

**1. GET movements - Filter by warehouse:**
- Add `warehouse_id` query parameter
- Filter: `from_warehouse_id = $1 OR to_warehouse_id = $1`
- Only show movements involving the admin's warehouse

**2. Receive action - Validate destination:**
- Require `movement_id` to complete a shipment
- Check `to_warehouse_id` matches admin's warehouse
- Get product details from movement, then:
  - If part_number exists in destination warehouse → increase quantity
  - If not exists → create new product entry with quantity from movement

---

### Frontend Changes

#### [MODIFY] [Inventory.jsx](file:///Users/charanpreetsingh/modparts-ui/modparts-17dec/frontend/src/pages/admin/Inventory.jsx)

**1. fetchMovements - Pass warehouse filter:**
- Send `adminWarehouseId` to API
- Only show movements where admin is sender OR receiver

**2. Receive mode - Use movements list:**
- In RECEIVE mode, show pending movements where `to_warehouse_id = adminWarehouseId`
- Remove barcode scanning for receive (use movement selection)
- Add "Receive" button on each pending movement

---

### Flow After Implementation

| Action | What Happens |
|--------|--------------|
| Admin A sends 5 units to Admin B | Movement created, qty reduced at A |
| Admin B sees movement in "Incoming" | Movements tab shows pending shipment |
| Admin B clicks "Receive" | Validates destination, increases/creates product at B |

## Verification
- Test sending product between warehouses
- Verify movements filtered correctly
- Verify receive updates correct inventory
