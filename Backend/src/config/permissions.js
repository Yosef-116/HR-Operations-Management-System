const CORE_ROLES = [
  {
    roleName: 'Admin',
    permissions: ['manage_all']
  },
  { roleName: 'HR_Manager', permissions: [
    'manage_org', 'manage_recruitment', 'manage_people',
    'manage_performance', 'manage_training', 'manage_shared',
    'approve_leave', 'approve_promotion', 'resolve_grievance',
    'process_exit',
    'view_payroll',      // ← ADD: so they can list leave/expense/payslips
    ]
  },
  { roleName: 'Finance', permissions: [
    'manage_payroll', 'approve_expense', 'process_payroll', 'view_payroll',
    'view_org',          // ← ADD: so they can look up employees
    'view_recruitment',  // ← ADD: so they can look up job titles
    ]
  },
  { roleName: 'Manager', permissions: [
    'view_org', 'view_performance', 'edit_performance',
    'approve_leave', 'approve_expense', 'approve_promotion',
    'view_payroll',      // ← ADD: so they can list pending leave/expenses
    ]
  },
  { roleName: 'Employee', permissions: [
    'view_self', 'request_leave', 'submit_expense', 'view_shared',
    'view_org',          // ← ADD: so they can read their own employee record
    'create_payroll',    // ← ADD: so they can POST leave requests and expense claims
    ]
  }
];

module.exports = {
  CORE_ROLES
};
