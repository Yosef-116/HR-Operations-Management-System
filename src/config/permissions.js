const CORE_ROLES = [
  {
    roleName: 'Admin',
    permissions: ['manage_all']
  },
  {
    roleName: 'HR_Manager',
    permissions: [
      'manage_org',
      'manage_recruitment',
      'manage_people',
      'manage_performance',
      'manage_training',
      'manage_shared',
      'approve_leave',
      'approve_promotion',
      'resolve_grievance',
      'process_exit'
    ]
  },
  {
    roleName: 'Finance',
    permissions: [
      'manage_payroll',
      'approve_expense',
      'process_payroll',
      'view_payroll'
    ]
  },
  {
    roleName: 'Manager',
    permissions: [
      'view_org',
      'view_performance',
      'edit_performance',
      'approve_leave',
      'approve_expense',
      'approve_promotion'
    ]
  },
  {
    roleName: 'Employee',
    permissions: [
      'view_self',
      'request_leave',
      'submit_expense',
      'view_shared'
    ]
  }
];

module.exports = {
  CORE_ROLES
};
