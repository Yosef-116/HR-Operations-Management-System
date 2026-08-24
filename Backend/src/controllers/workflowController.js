const workflowService = require('../services/workflowService');
const asyncHandler = require('../utils/asyncHandler');

const reqMeta = (req) => ({
  userId: req.user && req.user.user_id,
  employeeId: req.user && req.user.employee_id,
  ipAddress: req.ip
});

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

module.exports = {
  calculatePayroll: asyncHandler(async (req, res) => ok(res, await workflowService.calculatePayroll(req.body))),

  generatePayslips: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.generatePayslips(req.params.runId, req.body, reqMeta(req)),
    201
  )),

  approvePayrollRun: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.updatePayrollRunStatus(req.params.runId, 'Approved', req.body.approved_by || (req.user && req.user.employee_id), reqMeta(req))
  )),

  processPayrollRun: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.updatePayrollRunStatus(req.params.runId, 'Processed', req.body.approved_by || (req.user && req.user.employee_id), reqMeta(req))
  )),

  approveLeaveRequest: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.approveLeaveRequest(req.params.requestId, { ...req.body, status: 'Approved' }, reqMeta(req))
  )),

  rejectLeaveRequest: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.approveLeaveRequest(req.params.requestId, { ...req.body, status: 'Rejected' }, reqMeta(req))
  )),

  getLeaveBalance: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.getLeaveBalance(req.params.employeeId, req.query.type_id, req.query.year)
  )),

  approveExpenseClaim: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.approveExpenseClaim(req.params.claimId, { ...req.body, status: req.body.status || 'Approved' }, reqMeta(req))
  )),

  assignAsset: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.assignAsset(req.params.assetId, req.body, reqMeta(req)),
    201
  )),

  returnAsset: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.returnAsset(req.params.assignmentId, req.body, reqMeta(req))
  )),

  createOnboardingChecklist: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.createOnboardingChecklist(req.body, reqMeta(req)),
    201
  )),

  completeOnboardingTask: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.completeOnboardingTask(req.params.taskId, req.body, reqMeta(req))
  )),

  exitEmployee: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.exitEmployee(req.params.employeeId, req.body, reqMeta(req)),
    201
  )),

  fileGrievance: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.fileGrievance(req.body, reqMeta(req)),
    201
  )),

  resolveGrievance: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.resolveGrievance(req.params.grievanceId, req.body, reqMeta(req))
  )),

  hireCandidate: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.hireCandidate(req.params.candidateId, req.body, reqMeta(req)),
    201
  )),

  assessPromotion: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.assessPromotion(req.params.promotionId, req.body, reqMeta(req)),
    201
  )),

  actOnPromotion: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.actOnPromotion(req.params.promotionId, req.body, reqMeta(req))
  )),

  evaluateGoal: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.evaluateGoal(req.params.goalId, req.body, reqMeta(req))
  )),

  closePerformancePlan: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.closePerformancePlan(req.params.planId, reqMeta(req))
  )),

  evaluateTraining: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.evaluateTraining(req.params.trainingId, req.body, reqMeta(req)),
    201
  )),

  uploadDocument: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.recordDocument(req.file, req.body, reqMeta(req)),
    201
  )),

  clockIn: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.clockIn(req.body, reqMeta(req)),
    201
  )),

  clockOut: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.clockOut(req.body, reqMeta(req))
  )),

  approveOvertime: asyncHandler(async (req, res) => ok(
    res,
    await workflowService.approveOvertime(req.params.overtimeId, req.body, reqMeta(req))
  ))
};
