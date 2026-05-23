const instanceService = require('../services/instance.service');
const XLSX = require('xlsx');

const PREFERENCE_NOT_GIVEN_SHEET = 'Preference Not given students';

exports.downloadAllocations = async (req, res, next) => {
  try {
    const instanceId = req.params.id;
    const {
      allocated,
      unallocated,
      preferenceNotGiven,
      summary
    } = await instanceService.getAllocationsForDownload(instanceId);

    const workbook = XLSX.utils.book_new();

    // Allocated Students Sheet
    const wsAllocated = XLSX.utils.json_to_sheet(allocated || []);
    XLSX.utils.book_append_sheet(workbook, wsAllocated, 'Allocated Students');

    // Unallocated Students Sheet
    const wsUnallocated = XLSX.utils.json_to_sheet(unallocated || []);
    XLSX.utils.book_append_sheet(workbook, wsUnallocated, 'Un-Allocated Students');

    // Preference Not Given Student List Sheet
    const wsPreferenceNotGiven = XLSX.utils.json_to_sheet(preferenceNotGiven || []);
    XLSX.utils.book_append_sheet(
      workbook,
      wsPreferenceNotGiven,
      PREFERENCE_NOT_GIVEN_SHEET
    );

    // Summary Sheet
    const wsSummary = XLSX.utils.aoa_to_sheet(summary || []);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="student_allocations_${instanceId}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

exports.getAllocationsJson = async (req, res, next) => {
  try {
    const instanceId = req.params.id;
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const {
      allocated,
      unallocated,
      preferenceNotGiven,
      summary
    } = await instanceService.getAllocationsForDownload(instanceId);

    let filteredAllocated = allocated || [];
    let filteredUnallocated = unallocated || [];
    let filteredPreferenceNotGiven = preferenceNotGiven || [];

    if (departmentId && Number.isInteger(departmentId)) {
      filteredAllocated = filteredAllocated.filter((row) => Number(row.department_id) === departmentId);
      filteredUnallocated = filteredUnallocated.filter((row) => Number(row.department_id) === departmentId);
      filteredPreferenceNotGiven = filteredPreferenceNotGiven.filter(
        (row) => Number(row.department_id) === departmentId
      );
    }

    res.json({
      allocated: filteredAllocated,
      unallocated: filteredUnallocated,
      preferenceNotGiven: filteredPreferenceNotGiven,
      summary
    });
  } catch (error) {
    next(error);
  }
};
