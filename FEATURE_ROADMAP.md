# StockWise Feature Roadmap

## Recommended Features for Production Launch

### Priority 1: Essential for Launch (Must Have)

#### 1. **Export & Reporting**
**Priority**: Critical  
**Effort**: Medium  
**Impact**: High

**Features**:
- Export sales reports to Excel/CSV
- Export profit & loss reports to PDF
- Export inventory reports
- Scheduled email reports (daily/weekly/monthly)
- Custom date range exports

**Why**: Restaurants need to share reports with accountants, tax authorities, and stakeholders. Excel/PDF exports are industry standard.

**Implementation**:
- Use libraries like `xlsx` for Excel export
- Use `pdfkit` or `react-pdf` for PDF generation
- Create API endpoints for report generation
- Add "Export" buttons to all report pages

---

#### 2. **Notifications & Alerts System**
**Priority**: Critical  
**Effort**: Medium  
**Impact**: High

**Features**:
- Email notifications for low stock
- In-app notification center
- Alert when stock runs out during sales
- Daily summary emails
- Price change alerts

**Why**: Proactive alerts prevent stockouts and help owners stay informed without constantly checking the dashboard.

**Implementation**:
- Integrate with email service (SendGrid, Resend, or Supabase Edge Functions)
- Create notification preferences in user settings
- Build notification center component
- Add real-time notifications using Supabase Realtime

---

#### 3. **Supplier Management**
**Priority**: High  
**Effort**: Medium  
**Impact**: Medium-High

**Features**:
- Add/edit/delete suppliers
- Supplier contact information
- Purchase history per supplier
- Supplier performance tracking
- Link restocking to suppliers

**Why**: Restaurants need to track where they buy from, compare prices, and manage supplier relationships.

**Implementation**:
- Create `suppliers` table
- Add `supplier_id` to `restocking` table
- Create supplier management UI
- Add supplier selection in restocking form

---

#### 4. **Purchase Orders**
**Priority**: High  
**Effort**: High  
**Impact**: High

**Features**:
- Create purchase orders
- Send purchase orders to suppliers
- Track order status (Pending, Received, Cancelled)
- Link purchase orders to restocking
- Purchase order history

**Why**: Streamlines procurement process and provides better inventory planning.

**Implementation**:
- Create `purchase_orders` table
- Create `purchase_order_items` table
- Build purchase order creation UI
- Add email functionality for sending POs

---

#### 5. **Inventory Valuation**
**Priority**: High  
**Effort**: Medium  
**Impact**: High

**Features**:
- Current inventory value (at cost)
- Current inventory value (at selling price)
- Inventory turnover ratio
- Days of inventory on hand
- Valuation reports

**Why**: Critical for financial planning and understanding cash tied up in inventory.

**Implementation**:
- Calculate inventory value from opening stock + restocking - sales
- Add valuation cards to dashboard
- Create valuation report page
- Add inventory turnover calculations

---

### Priority 2: Important for Growth (Should Have)

#### 6. **Reorder Points & Automated Alerts**
**Priority**: Medium-High  
**Effort**: Medium  
**Impact**: Medium-High

**Features**:
- Set minimum stock levels per item
- Automatic alerts when stock falls below reorder point
- Suggested reorder quantities
- Reorder point recommendations based on sales history

**Why**: Prevents stockouts and helps with inventory planning.

**Implementation**:
- Add `reorder_point` and `reorder_quantity` to `items` table
- Enhance low stock alerts to use reorder points
- Add reorder point management in item management
- Calculate suggested reorder points from sales patterns

---

#### 7. **Barcode Scanning**
**Priority**: Medium  
**Effort**: High  
**Impact**: Medium

**Features**:
- Add barcode to items
- Scan barcodes for quick item selection
- Mobile-friendly barcode scanner
- Bulk barcode import

**Why**: Speeds up inventory operations, especially for high-volume items.

**Implementation**:
- Add `barcode` field to `items` table
- Use camera API for barcode scanning
- Integrate with barcode scanning library (e.g., `html5-qrcode`)
- Add barcode input in item management

---

#### 8. **Multi-Location Support (Enhanced)**
**Priority**: Medium  
**Effort**: High  
**Impact**: Medium-High

**Features**:
- Transfer stock between locations
- Consolidated reporting across locations
- Location-specific pricing
- Location performance comparison

**Why**: Essential for restaurant chains and multi-location businesses.

**Implementation**:
- Add `locations` table
- Add `location_id` to all transaction tables
- Create stock transfer functionality
- Build location comparison reports

---

#### 9. **API & Integrations**
**Priority**: Medium  
**Effort**: High  
**Impact**: Medium

**Features**:
- RESTful API for third-party integrations
- Webhook support
- POS system integration (Square, Toast, etc.)
- Accounting software integration (QuickBooks, Xero)

**Why**: Allows restaurants to connect with existing tools and automate workflows.

**Implementation**:
- Create API authentication (API keys)
- Build API documentation (OpenAPI/Swagger)
- Create webhook system
- Build integration marketplace

---

#### 10. **Mobile App / PWA**
**Priority**: Medium  
**Effort**: High  
**Impact**: High

**Features**:
- Progressive Web App (PWA) for mobile access
- Offline mode for recording sales
- Mobile-optimized UI
- Push notifications

**Why**: Staff often need to record sales on mobile devices. PWA provides app-like experience without app store.

**Implementation**:
- Add PWA manifest
- Implement service worker for offline support
- Optimize UI for mobile screens
- Add mobile-specific features (camera for barcode scanning)

---

### Priority 3: Nice to Have (Future Enhancements)

#### 11. **Advanced Analytics**
**Priority**: Low-Medium  
**Effort**: Medium  
**Impact**: Medium

**Features**:
- Predictive analytics for demand forecasting
- Seasonal trend analysis
- Item profitability ranking
- Customer behavior insights (if POS integrated)

**Why**: Helps restaurants optimize inventory and pricing strategies.

---

#### 12. **Tax Reporting**
**Priority**: Low-Medium  
**Effort**: Medium  
**Impact**: Medium

**Features**:
- Tax calculation and reporting
- VAT/GST tracking
- Tax-exempt items
- Tax reports for filing

**Why**: Simplifies tax compliance for restaurant owners.

---

#### 13. **Backup & Restore**
**Priority**: Low  
**Effort**: Low-Medium  
**Impact**: Low-Medium

**Features**:
- Manual data backup
- Scheduled automatic backups
- Data restore functionality
- Export all data

**Why**: Data safety and compliance requirements.

---

#### 14. **Audit Logs**
**Priority**: Low  
**Effort**: Medium  
**Impact**: Low-Medium

**Features**:
- Detailed audit log of all actions
- User activity tracking
- Change history for all records
- Audit log export

**Why**: Enhanced security and compliance.

---

#### 15. **Multi-Currency Support**
**Priority**: Low  
**Effort**: Medium  
**Impact**: Low

**Features**:
- Support multiple currencies
- Currency conversion
- Multi-currency reporting

**Why**: Important for international expansion.

---

## Implementation Priority Matrix

```
High Impact, Low Effort → Do First
- Export & Reporting
- Notifications & Alerts
- Inventory Valuation

High Impact, High Effort → Plan Carefully
- Purchase Orders
- API & Integrations
- Mobile App/PWA

Low Impact, Low Effort → Quick Wins
- Backup & Restore
- Audit Logs

Low Impact, High Effort → Defer
- Advanced Analytics
- Multi-Currency
```

---

## Recommended Launch Sequence

### Phase 1: MVP+ (Current + Essential)
1. ✅ Current features (already implemented)
2. Export & Reporting
3. Notifications & Alerts
4. Inventory Valuation

### Phase 2: Growth Features
5. Supplier Management
6. Purchase Orders
7. Reorder Points
8. Barcode Scanning

### Phase 3: Scale Features
9. API & Integrations
10. Mobile App/PWA
11. Multi-Location (Enhanced)

### Phase 4: Advanced Features
12. Advanced Analytics
13. Tax Reporting
14. Other nice-to-haves

---

## Success Metrics

Track these metrics to measure feature success:

- **User Adoption**: % of users using new features
- **Time Saved**: Reduction in time spent on inventory tasks
- **Error Reduction**: Decrease in inventory discrepancies
- **User Satisfaction**: NPS scores and feedback
- **Revenue Impact**: Increased revenue from better inventory management

---

*Last Updated: December 2025*

