const fs = require('fs');
const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const workflowController = require('../controllers/workflowController');
const { requireAnyPermission } = require('../middleware/auth');

fs.mkdirSync(env.uploadDir, { recursive: true });

const upload = multer({ dest: env.uploadDir });
const router = express.Router();

router.post('/payroll/calculate', requireAnyPermission(['view_payroll', 'process_payroll', 'manage_payroll']), workflowController.calculatePayroll);
router.post('/payroll/runs/:runId/generate-payslips', requireAnyPermission(['process_payroll', 'manage_payroll']), workflowController.generatePayslips);
router.post('/payroll/runs/:runId/approve', requireAnyPermission(['process_payroll', 'manage_payroll']), workflowController.approvePayrollRun);
router.post('/payroll/runs/:runId/process', requireAnyPermission(['process_payroll', 'manage_payroll']), workflowController.processPayrollRun);

router.post('/leave-requests/:requestId/approve', requireAnyPermission(['approve_leave', 'manage_payroll']), workflowController.approveLeaveRequest);
router.post('/leave-requests/:requestId/reject', requireAnyPermission(['approve_leave', 'manage_payroll']), workflowController.rejectLeaveRequest);
router.get('/employees/:employeeId/leave-balance', requireAnyPermission(['view_payroll', 'approve_leave', 'manage_payroll', 'manage_org']), workflowController.getLeaveBalance);

router.post('/expense-claims/:claimId/approve', requireAnyPermission(['approve_expense', 'manage_payroll']), workflowController.approveExpenseClaim);

router.post('/assets/:assetId/assign', requireAnyPermission(['manage_org']), workflowController.assignAsset);
router.post('/asset-assignments/:assignmentId/return', requireAnyPermission(['manage_org']), workflowController.returnAsset);

router.post('/onboarding/checklists', requireAnyPermission(['manage_org']), workflowController.createOnboardingChecklist);
router.post('/onboarding/tasks/:taskId/complete', requireAnyPermission(['manage_org']), workflowController.completeOnboardingTask);

router.post('/employees/:employeeId/exit', requireAnyPermission(['process_exit', 'manage_org']), workflowController.exitEmployee);
router.post('/grievances/:grievanceId/resolve', requireAnyPermission(['resolve_grievance', 'manage_org']), workflowController.resolveGrievance);

router.post('/recruitment/candidates/:candidateId/hire', requireAnyPermission(['manage_recruitment']), workflowController.hireCandidate);

router.post('/promotions/:promotionId/assess', requireAnyPermission(['approve_promotion', 'manage_people']), workflowController.assessPromotion);
router.post('/promotions/:promotionId/action', requireAnyPermission(['approve_promotion', 'manage_people']), workflowController.actOnPromotion);

router.post('/performance/goals/:goalId/evaluate', requireAnyPermission(['edit_performance', 'manage_performance']), workflowController.evaluateGoal);
router.post('/performance/plans/:planId/close', requireAnyPermission(['edit_performance', 'manage_performance']), workflowController.closePerformancePlan);

router.post('/trainings/:trainingId/evaluate', requireAnyPermission(['manage_training']), workflowController.evaluateTraining);

router.post('/documents/upload', requireAnyPermission(['manage_shared', 'view_shared']), upload.single('file'), workflowController.uploadDocument);

module.exports = router;
