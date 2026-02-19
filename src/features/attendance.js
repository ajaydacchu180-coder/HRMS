import { hrmsData, saveData } from '../store/data.js';
import { api } from '../services/api.js';

function getRolePrefix(role) {
    if (role === 'admin') return 'adm';
    if (role === 'manager') return 'mgr';
    return 'emp';
}

function syncAttendanceState(role, payload) {
    hrmsData.attendance[role] = {
        ...hrmsData.attendance[role],
        ...payload,
        breaks: payload.breaks || hrmsData.attendance[role].breaks || [],
    };
}

function syncCheckinWidgets(role) {
    const prefix = getRolePrefix(role);
    const data = hrmsData.attendance[role];

    const checkinBtn = document.getElementById(`${prefix}CheckinBtn`);
    const checkoutBtn = document.getElementById(`${prefix}CheckoutBtn`);
    const breakControls = document.getElementById(`${prefix}BreakControls`);
    const reportSection = document.getElementById(role === 'manager' ? 'mgrDailyReportSection' : 'dailyReportSection');
    const statusEl = document.getElementById(`${prefix}Status`);

    const checkedIn = data.status === 'checked_in';
    if (checkinBtn) checkinBtn.style.display = checkedIn ? 'none' : 'inline-flex';
    if (checkoutBtn) checkoutBtn.style.display = checkedIn ? 'inline-flex' : 'none';
    if (breakControls) breakControls.style.display = checkedIn ? 'flex' : 'none';
    if (reportSection) reportSection.style.display = checkedIn ? 'block' : 'none';
    if (statusEl) {
        statusEl.textContent = checkedIn ? `Checked in at ${data.checkinTime || '--:--'}` : 'Not Checked In';
    }
}

export async function refreshAttendanceStatus(role) {
    try {
        const status = await api.getStatus();
        syncAttendanceState(role, status);
        saveData();
        syncCheckinWidgets(role);
    } catch (error) {
        console.error('Status sync failed:', error);
    }
}

export async function handleCheckin(role) {
    try {
        const result = await api.checkin();
        syncAttendanceState(role, result);
        const userName = hrmsData.profiles[role]?.name || role;
        hrmsData.employeeStatus[userName] = {
            status: 'Online',
            statusClass: 'present',
            time: result.checkinTime || '',
            role,
            location: 'Office',
        };
        saveData();
        syncCheckinWidgets(role);
        alert(`Checked in at ${result.checkinTime || 'now'}`);
    } catch (error) {
        alert(error.message || 'Failed to check in');
    }
}

export async function handleCheckout(role) {
    try {
        const result = await api.checkout();
        syncAttendanceState(role, result);

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const userName = hrmsData.profiles[role]?.name || role;

        hrmsData.employeeStatus[userName] = {
            status: 'Checked Out',
            statusClass: 'absent',
            time,
            role,
            location: 'Remote',
        };

        addToActivityLog(dateStr, `${userName} Checked Out at ${time}`, 'Left Work', 'status-badge');
        saveData();
        syncCheckinWidgets(role);
        alert(`Checked out at ${result.checkoutTime || time}`);
    } catch (error) {
        alert(error.message || 'Failed to check out');
    }
}

export async function toggleBreak(role, type, durationMins) {
    const userName = hrmsData.profiles[role]?.name || role;
    const attData = hrmsData.attendance[role];
    const activeBreak = (attData.breaks || []).find(b => !b.endTime);

    try {
        let result;
        if (activeBreak) {
            if (activeBreak.type !== type) {
                alert(`You are currently on ${activeBreak.type} break.`);
                return;
            }
            result = await api.endBreak();
            if (!hrmsData.employeeStatus[userName]) {
                hrmsData.employeeStatus[userName] = { role, location: 'Office' };
            }
            hrmsData.employeeStatus[userName].status = 'Online';
            hrmsData.employeeStatus[userName].statusClass = 'present';
        } else {
            result = await api.startBreak(type, durationMins);
            if (!hrmsData.employeeStatus[userName]) {
                hrmsData.employeeStatus[userName] = { role, location: 'Office' };
            }
            hrmsData.employeeStatus[userName].status = `Break: ${type}`;
            hrmsData.employeeStatus[userName].statusClass = 'pending';
        }

        syncAttendanceState(role, result);
        saveData();
    } catch (error) {
        alert(error.message || 'Break action failed');
    }
}

export function addToActivityLog(date, activity, statusText, statusClass) {
    const entry = { date, activity, statusText, statusClass };
    hrmsData.activityLog.unshift(entry);
    if (hrmsData.activityLog.length > 50) hrmsData.activityLog.pop();
    saveData();
}

export async function submitDailyReport(role) {
    const rolePrefix = role === 'manager' ? 'mgr' : '';
    const textId = rolePrefix ? 'mgrDailyReportText' : 'dailyReportText';
    const imgId = rolePrefix ? 'mgrDailyReportImage' : 'dailyReportImage';
    const pdfId = rolePrefix ? 'mgrDailyReportPDFs' : 'dailyReportPDFs';

    const textInput = document.getElementById(textId);
    const imageInput = document.getElementById(imgId);
    const pdfInput = document.getElementById(pdfId);

    if (!textInput || !imageInput) {
        alert('Report form not available on this tab.');
        return;
    }

    const text = textInput.value.trim();
    const imageFile = imageInput.files?.[0] || null;
    const attachmentFiles = pdfInput?.files ? Array.from(pdfInput.files) : [];

    if (!text) {
        alert('Please provide a report description.');
        return;
    }
    if (!imageFile) {
        alert('Please attach a supporting image.');
        return;
    }

    try {
        const report = await api.submitReport({ content: text, imageFile, attachmentFiles });
        hrmsData.reports.unshift(report);
        hrmsData.attendance[role].reportSubmitted = true;
        saveData();

        textInput.value = '';
        imageInput.value = '';
        if (pdfInput) pdfInput.value = '';

        alert('Daily report submitted successfully.');
    } catch (error) {
        alert(error.message || 'Error submitting report');
    }
}

export async function submitLeaveRequest() {
    const type = document.getElementById('empLeaveType')?.value;
    const from = document.getElementById('empLeaveFrom')?.value;
    const to = document.getElementById('empLeaveTo')?.value;
    const reason = document.getElementById('empLeaveReason')?.value;

    if (!from || !to || !reason) {
        alert('Please fill all required fields.');
        return;
    }

    try {
        const leave = await api.submitLeave({
            type,
            fromDate: from,
            toDate: to,
            reason,
        });

        hrmsData.leaves.unshift({
            id: leave._id || leave.id || Date.now(),
            employee: hrmsData.profiles.employee.name,
            type,
            from,
            to,
            reason,
            status: leave.status || 'Pending',
            timestamp: new Date().toLocaleString(),
        });
        saveData();

        document.getElementById('empLeaveFrom').value = '';
        document.getElementById('empLeaveTo').value = '';
        document.getElementById('empLeaveReason').value = '';
        alert('Leave request submitted successfully.');
    } catch (error) {
        alert(error.message || 'Failed to submit leave request');
    }
}

export async function approveLeave(id) {
    try {
        await api.updateLeaveStatus(id, 'Approved');
        const leave = hrmsData.leaves.find(l => String(l.id) === String(id));
        if (leave) leave.status = 'Approved';
        saveData();
        alert('Leave request approved.');
    } catch (error) {
        alert(error.message || 'Failed to approve leave');
    }
}

export async function rejectLeave(id) {
    try {
        await api.updateLeaveStatus(id, 'Rejected');
        const leave = hrmsData.leaves.find(l => String(l.id) === String(id));
        if (leave) leave.status = 'Rejected';
        saveData();
        alert('Leave request rejected.');
    } catch (error) {
        alert(error.message || 'Failed to reject leave');
    }
}
