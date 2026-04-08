# DMS Pro - Use Cases & Test Cases

This document outlines the key use cases and test cases for validating the features of the Distribution Management System (DMS Pro).

## 1. User Authentication & RBAC
### Use Case: Secure Login and Role-Based Access
**Goal**: Ensure users can log in and only see features relevant to their role.

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-AUTH-01 | Admin Login | 1. Log in with `mrwater.prov1@gmail.com`. | Full sidebar access (User Management, Company Master, etc.). |
| TC-AUTH-02 | Sales Rep Login | 1. Log in with a Sales Rep account. | Limited access (Sales App, Orders, Customers). |
| TC-AUTH-03 | Unauthorized Access | 1. Attempt to access `/users` directly as Sales Rep. | System redirects or blocks access. |

## 2. Multi-Company Management
### Use Case: Managing Multiple Principals
**Goal**: Add and manage products for different companies (HUL, ITC, Amul, etc.).

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-COMP-01 | Add New Company | 1. Go to Company Master. 2. Click "Add Company". 3. Enter details for "Company A". | Company A appears in the master list. |
| TC-COMP-02 | Filter by Company | 1. Go to Product Master. 2. Use the brand/company filter. | Only products belonging to the selected company are shown. |

## 3. Inventory & Stock Management
### Use Case: Real-Time Stock Updates
**Goal**: Ensure stock levels update correctly during sales and inward movements.

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-INV-01 | Add Stock (Inward) | 1. Select a product. 2. Click "Update Stock". 3. Add 100 units. | Product stock increases by 100; Stock Movement log updated. |
| TC-INV-02 | Stock Update on Sale | 1. Create a new order for 10 units of "Surf Excel". 2. Complete the order. | Surf Excel stock decreases by 10 units. |
| TC-INV-03 | Low Stock Alert | 1. Reduce stock of a product below its reorder level. | System generates a "Low Stock" notification. |

## 4. Sales & Order Management
### Use Case: End-to-End Order Workflow
**Goal**: Validate order creation, approval, and invoicing.

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-ORD-01 | Create New Order | 1. Go to Order Management. 2. Click "New Order". 3. Select items and customer. | Order is created with "Pending" status. |
| TC-ORD-02 | Manager Approval | 1. Log in as Manager. 2. Go to Approvals. 3. Approve a pending order. | Order status changes to "Approved". |
| TC-ORD-03 | Generate Invoice | 1. Select an approved order. 2. Click "View Invoice". | Professional PDF-style invoice is displayed. |

## 5. Returns & Damage Management
### Use Case: RMA and Credit Note Generation
**Goal**: Handle product returns and financial adjustments.

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-RET-01 | Initiate Return | 1. Go to Returns. 2. Create a return for "Damaged" goods. | RMA number is generated; status is "Pending Approval". |
| TC-RET-02 | Credit Note Issue | 1. Approve the return. 2. Verify physical stock. | Credit note is automatically generated for the customer. |

## 6. Reporting & Analytics
### Use Case: Data-Driven Decision Making
**Goal**: Verify accuracy of dashboards and reports.

| Test Case ID | Description | Steps | Expected Result |
|--------------|-------------|-------|-----------------|
| TC-REP-01 | Executive Dashboard | 1. View Dashboard. | Real-time sales vs target and OOS SKUs are accurate. |
| TC-REP-02 | Custom Report | 1. Use Report Builder. 2. Select "Net Sales" and "Brand". | Report is generated with correct data; Export to Excel works. |
