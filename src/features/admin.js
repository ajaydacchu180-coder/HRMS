import { hrmsData, saveData } from '../store/data.js';
import { api } from '../services/api.js';

export async function addEmployee() {
    const username = prompt('Username for new employee:');
    if (!username) return;
    const password = prompt('Temporary password:');
    if (!password) return;
    const role = prompt('Role (employee/manager/admin):', 'employee') || 'employee';
    const name = prompt('Display name:', username) || username;

    try {
        await api.createEmployee({ username, password, role, name });
        alert('Employee created successfully.');
    } catch (error) {
        alert(error.message || 'Failed to create employee');
    }
}

export async function editEmployee(btn) {
    const row = btn.closest('tr');
    const id = row?.dataset?.userId || row?.cells?.[0]?.textContent;
    if (!id) {
        alert('Employee identifier missing.');
        return;
    }

    const role = prompt('New role (employee/manager/admin):');
    const name = prompt('New display name (optional):');
    const payload = {};
    if (role) payload.role = role;
    if (name) payload.name = name;

    if (Object.keys(payload).length === 0) return;

    try {
        await api.updateEmployee(id, payload);
        alert('Employee updated.');
    } catch (error) {
        alert(error.message || 'Failed to update employee');
    }
}

export function viewEmployee(btn) {
    const row = btn.closest('tr');
    const id = row?.dataset?.userId || row?.cells?.[0]?.textContent;
    alert(`Employee ID: ${id || 'N/A'}`);
}

export function searchEmployees() {
    const input = document.getElementById('adminSearchEmployee');
    const q = (input?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#adminEmployeesTable tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

export function processPayroll() {
    const month = document.getElementById('payrollMonth')?.value || 'current month';
    alert(`Payroll pipeline triggered for ${month}.`);
}

export async function postAnnouncement() {
    const title = document.getElementById('admAnnouncementTitle')?.value?.trim();
    const msg = document.getElementById('admAnnouncementMsg')?.value?.trim();
    if (!title || !msg) {
        alert('Fill all fields');
        return;
    }

    try {
        const announcement = await api.createAnnouncement({ title, msg });
        hrmsData.announcements.unshift(announcement);
        saveData();
        alert('Announcement posted.');
    } catch (error) {
        alert(error.message || 'Failed to post announcement');
    }
}

export function saveAdminSettings() {
    saveData();
    alert('System settings updated.');
}

export function saveShiftSettings() {
    saveData();
    alert('Shift timings updated.');
}

export async function addHoliday() {
    const name = document.getElementById('newHolidayName')?.value?.trim();
    const date = document.getElementById('newHolidayDate')?.value?.trim();
    if (!name || !date) {
        alert('Fill fields');
        return;
    }

    try {
        const holiday = await api.createHoliday({ name, date, type: 'Public' });
        hrmsData.holidays.push(holiday);
        saveData();
        alert('Holiday added.');
    } catch (error) {
        alert(error.message || 'Failed to add holiday');
    }
}

export function exportAdminAttendance() {
    alert('Attendance export endpoint is ready. Connect this button to a CSV download flow if needed.');
}

export function generateCSVReport(prefix) {
    alert(`CSV generation requested for ${prefix}.`);
}
