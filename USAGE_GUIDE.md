# 🏢 WorkForce HR Operations Management System - Usage Guide

Welcome to the WorkForce HR Operations Management System! This guide will help you navigate the platform, understand the different roles, and perform key tasks such as adding employees, managing payroll, and handling leave requests.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Roles and Permissions](#roles-and-permissions)
3. [Admin Workflow: Adding an Employee](#admin-workflow-adding-an-employee)
4. [Employee Workflow: Signing Up and Logging In](#employee-workflow-signing-up-and-logging-in)
5. [Navigating the Dashboard](#navigating-the-dashboard)
6. [Key Modules Overview](#key-modules-overview)

---

## Getting Started

The HR Operations Management System is accessible via the live web dashboard. 

🔗 **Live Website:** [hr-operations-management-system.onrender.com](https://hr-operations-management-system.onrender.com)

To begin using the system, you must log in with your credentials. If you are an administrator setting up the system for the first time, you will use the default admin credentials.

### Default Admin Login
- **Email/Username:** `admin`
- **Password:** `AdminPass123!`

---

## Roles and Permissions

The system uses Role-Based Access Control (RBAC) to ensure users only see what they are permitted to access. There are five primary roles:

1. **Admin:** Full access to all modules, including system configuration, audit logs, and user management.
2. **HR Manager:** Access to employee records, recruitment, performance, training, and onboarding.
3. **Finance:** Access to payroll, payslips, and expense claims.
4. **Manager:** Access to their team's performance, leave requests, and approvals.
5. **Employee:** Access to their own profile, payslips, leave requests, and expense claims.

---

## Admin Workflow: Adding an Employee

Before an employee can use the system, an Admin or HR Manager must create their record in the database.

### Steps to Add an Employee:
1. **Log in** to the system using the Admin credentials (`admin` / `AdminPass123!`).
2. On the left sidebar, click on **Employees** under the "Main" section.
3. In the top right corner of the Employees page, click the **+ Add Employee** button.
4. A form will appear. Fill in the required details:
   - First Name
   - Last Name
   - Email (This must be a valid email, as the employee will use it to sign up)
   - Gender
   - Hire Date
   - National ID
   - Phone Number
5. Click **Add Employee** to save the record.

Once the employee is added, their email is registered in the system, allowing them to create their own account.

---

## Employee Workflow: Signing Up and Logging In

Once an Admin has added an employee to the system, the employee can create their account and log in.

### Steps for Employees to Sign Up:
1. Go to the [login page](https://hr-operations-management-system.onrender.com).
2. At the bottom of the login form, click the link that says **"Sign up with employee email"**.
3. A Sign Up form will appear. Enter the following:
   - **Employee Email:** The exact email address the Admin used when creating your record.
   - **Password:** Create a secure password (minimum 8 characters).
   - **Confirm Password:** Re-enter your password.
4. Click **Create Account**.

### Logging In:
After successfully signing up, return to the main login page, enter your email and the password you just created, and click **Sign in**. You will be directed to your personalized dashboard based on your role.

---

## Navigating the Dashboard

Once logged in, the sidebar on the left provides access to various modules based on your role.

- **Dashboard:** A high-level overview of key metrics (e.g., Total Employees, Pending Leave, Pending Expenses) and recent activity.
- **Global Search:** Use the search bar at the top right to quickly find employees or specific records.
- **User Profile:** Click your initial/avatar at the bottom left to view your profile or sign out.

---

## Key Modules Overview

Depending on your role, you will have access to some or all of the following modules:

### 👥 People & Employees
- **Employees:** View, search, and manage employee profiles.
- **Leave Requests:** Submit time off, view remaining balances, and approve/reject requests from direct reports.
- **Performance:** Track performance plans, goals, and reviews.
- **Training:** View scheduled training programs and evaluations.
- **Recruitment:** Manage job vacancies and track candidates through the hiring pipeline.

### 💰 Payroll & Finance
- **Payroll:** Generate payroll runs and calculate payslips (including tax and pension deductions).
- **Expenses:** Submit expense claims for reimbursement or review pending claims.

### ⚙️ Operations
- **Assets:** Register company equipment and assign it to employees.
- **Grievances:** File and track workplace grievances and resolutions.
- **Onboarding:** Manage task checklists for new hires.

### 🔒 Admin
- **Audit Logs:** View a complete history of all database changes (INSERT, UPDATE, DELETE) for security and compliance.

---

*For technical details, API documentation, and deployment instructions, please refer to the `README.md` file in the project repository.*
