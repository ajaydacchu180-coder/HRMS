import { hrmsData, saveData } from '../store/data.js';
import { escapeHTML } from '../utils/helpers.js';
import { api } from '../services/api.js';

export async function syncTeamStatus(role) {
    if (role === 'employee') return;
    try {
        const team = await api.getTeamStatus();
        const mapped = {};
        team.forEach(member => {
            mapped[member.name] = {
                status: member.status,
                statusClass: member.statusClass || 'present',
                time: member.time || '',
                role: member.role,
                location: member.location || 'Office',
            };
        });
        hrmsData.employeeStatus = mapped;
        saveData();
    } catch (error) {
        console.error('Team status sync failed:', error);
    }
}

export function updateRealTimeView() {
    const statusMap = hrmsData.employeeStatus || {};
    const employees = Object.keys(statusMap).map(name => ({ name, ...statusMap[name] }));

    const mgrBody = document.getElementById('mgrTeamActivityBody');
    const admBody = document.getElementById('admLiveStatusBody');

    if (employees.length === 0) {
        const empty = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No activity yet today</td></tr>';
        if (mgrBody) mgrBody.innerHTML = empty;
        if (admBody) admBody.innerHTML = empty;
        return;
    }

    const rows = employees.map(emp => `
        <tr>
            <td>${escapeHTML(emp.name)}</td>
            <td>${escapeHTML(emp.role?.toUpperCase() || 'N/A')}</td>
            <td><span class="status-badge ${emp.statusClass || 'present'}">${escapeHTML(emp.status || '')}</span></td>
            <td>${escapeHTML(emp.time || '')}</td>
            <td>${escapeHTML(emp.location || 'Office')}</td>
        </tr>
    `).join('');

    if (mgrBody) mgrBody.innerHTML = rows;
    if (admBody) admBody.innerHTML = rows;
}

export function renderActivityLog(role) {
    const tbodyId = role === 'manager' ? 'mgrActivityTableBody' : 'activityTableBody';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    let html = hrmsData.activityLog.map(item => `
        <tr>
            <td>${item.date}</td>
            <td>${escapeHTML(item.activity)}</td>
            <td><span class="status-badge ${item.statusClass}">${item.statusText}</span></td>
        </tr>
    `).join('');

    if (hrmsData.activityLog.length < 1) {
        html = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No activity available</td></tr>';
    }

    tbody.innerHTML = html;
}

export async function renderAllReports() {
    const mgrBody = document.getElementById('managerReportsBody');
    const admBody = document.getElementById('adminReportsBody');
    if (!mgrBody && !admBody) return;

    let reports = [];
    try {
        reports = await api.getReports();
        hrmsData.reports = reports;
        saveData();
    } catch (error) {
        console.error('Report fetch failed:', error);
        reports = hrmsData.reports || [];
    }

    const html = reports.map(r => `
        <tr>
            <td>${escapeHTML(`${r.date || ''} ${r.time || ''}`.trim())}</td>
            <td>${escapeHTML(r.employee || '')}</td>
            <td>${escapeHTML(r.content || '')}</td>
            <td>${r.imageUrl ? `<img src="${r.imageUrl}" style="width: 50px; height: 50px; border-radius: 4px;" onclick="window.open(this.src)">` : 'No Image'}</td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No reports yet</td></tr>';

    if (mgrBody) mgrBody.innerHTML = html;
    if (admBody) admBody.innerHTML = html;
}

export async function renderHolidays(role) {
    const tableId = role === 'admin' ? 'admHolidayTableBody' : role === 'manager' ? 'mgrHolidayTableBody' : 'empHolidayTableBody';
    const tbody = document.getElementById(tableId);
    if (!tbody) return;

    try {
        const holidays = await api.getHolidays();
        hrmsData.holidays = holidays;
        saveData();
    } catch (error) {
        console.error('Holiday fetch failed:', error);
    }

    tbody.innerHTML = (hrmsData.holidays || []).map(h => `
        <tr>
            <td>${h.date || ''}</td>
            <td>${h.day || ''}</td>
            <td>${h.name || ''}</td>
            <td><span class="status-badge ${h.type === 'National' ? 'present' : 'pending'}">${h.type || 'Public'}</span></td>
        </tr>
    `).join('');
}

export async function renderAnnouncements(role) {
    const containerId = role === 'employee' ? 'empAnnouncementsList' : null;
    const container = containerId ? document.getElementById(containerId) : null;
    try {
        hrmsData.announcements = await api.getAnnouncements();
        saveData();
    } catch (error) {
        console.error('Announcement fetch failed:', error);
    }

    if (!container) return;
    const list = hrmsData.announcements || [];
    if (list.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;">No announcements</p>';
        return;
    }
    container.innerHTML = list.map(a => `
        <div class="card" style="margin-bottom:10px;">
            <h4>${escapeHTML(a.title)}</h4>
            <p>${escapeHTML(a.msg)}</p>
            <small>${escapeHTML(a.poster)} • ${escapeHTML(a.date || '')}</small>
        </div>
    `).join('');
}

export async function updateProfileUI(role) {
    try {
        const serverProfile = await api.getProfile();
        hrmsData.profiles[role] = {
            ...hrmsData.profiles[role],
            name: serverProfile.name || '',
            email: serverProfile.email || '',
            phone: serverProfile.phone || '',
            address: serverProfile.address || '',
            dob: serverProfile.dob || '',
            job: serverProfile.jobTitle || hrmsData.profiles[role]?.job || '',
            dept: serverProfile.department || hrmsData.profiles[role]?.dept || '',
            profileImageUrl: serverProfile.profileImageUrl || '',
        };
        saveData();
    } catch (error) {
        console.error('Profile fetch failed:', error);
    }

    const profile = hrmsData.profiles[role];
    if (!profile) return;

    const nameDisp = document.getElementById('userNameDisplay');
    const roleDisp = document.getElementById('userRoleDisplay');
    const avatarDisp = document.getElementById('userAvatarDisplay');

    if (nameDisp) nameDisp.textContent = profile.name;
    if (roleDisp) roleDisp.textContent = profile.job || profile.designation || 'Staff';
    if (avatarDisp) {
        avatarDisp.textContent = (profile.name || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    const prefix = role === 'admin' ? 'adm' : role === 'manager' ? 'mgr' : 'emp';
    const nameInput = document.getElementById(`${prefix}ProfileName`);
    const emailInput = document.getElementById(`${prefix}ProfileEmail`);
    const phoneInput = document.getElementById(`${prefix}ProfilePhone`);
    const addrInput = document.getElementById(`${prefix}ProfileAddress`);
    const dobInput = document.getElementById(`${prefix}ProfileDOB`);

    if (nameInput) nameInput.value = profile.name || '';
    if (emailInput) emailInput.value = profile.email || '';
    if (phoneInput) phoneInput.value = profile.phone || '';
    if (addrInput) addrInput.value = profile.address || '';
    if (dobInput) dobInput.value = profile.dob || '';

    if (profile.profileImageUrl) {
        const disp = document.getElementById(`${prefix}ProfileImageDisplay`);
        if (disp) {
            disp.src = profile.profileImageUrl;
            disp.style.display = 'block';
            const initials = document.getElementById(`${prefix}ProfileInitials`);
            if (initials) initials.style.display = 'none';
        }
    }
}

export async function renderAdminEmployees() {
    const tbody = document.querySelector('#adminEmployeesTable tbody');
    if (!tbody) return;

    try {
        const employees = await api.getEmployees();
        const rows = employees.map(emp => `
            <tr data-user-id="${emp.id}">
                <td>${escapeHTML(emp.id)}</td>
                <td>${escapeHTML(emp.name || emp.username)}</td>
                <td>${escapeHTML(emp.role)}</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewEmployee(this)">View</button>
                    <button class="btn btn-primary" onclick="editEmployee(this)">Edit</button>
                </td>
            </tr>
        `).join('');
        tbody.innerHTML = rows || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No employees found</td></tr>';
    } catch (error) {
        console.error('Employee fetch failed:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444;">Failed to load employees</td></tr>';
    }
}
