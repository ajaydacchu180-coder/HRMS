import './css/style.css';
import { authService } from './services/auth.js';
import { hrmsData, updateDataFromStorage } from './store/data.js';
import { formatTimeDuration } from './utils/helpers.js';
import * as UI from './features/ui.js';
import * as Attendance from './features/attendance.js';
import * as Chat from './features/chat.js';
import * as Render from './features/render.js';
import * as Admin from './features/admin.js';
import * as Profile from './features/profile.js';

window.selectRole = UI.selectRole;
window.switchTab = (role, tabId) => {
    UI.switchTab(role, tabId);
    if (tabId.endsWith('-chat')) Chat.initChat(role);
    if (tabId.endsWith('-reports')) Render.renderAllReports();
    if (tabId.endsWith('-holidays')) Render.renderHolidays(role);
    if (tabId.endsWith('-announcements')) Render.renderAnnouncements(role);
    if (tabId === 'adm-employees') Render.renderAdminEmployees();
};
window.switchSubTab = UI.switchSubTab;
window.toggleSidebar = UI.toggleSidebar;

window.handleLogin = async () => {
    const role = window.selectedRole;
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (!role) return alert('Select a role');

    const valid = await authService.login(role, user, pass);
    if (!valid) return alert('Invalid credentials');

    document.getElementById('loginScreen').style.display = 'none';
    UI.setCurrentDashboard(role);
    const dash = document.getElementById(`${role}Dashboard`);
    dash.classList.add('active');
    dash.style.display = 'block';
    await initDashboard(role);
};

window.handleLogout = () => {
    if (confirm('Logout?')) {
        authService.logout();
        location.reload();
    }
};

window.handleCheckin = role => Attendance.handleCheckin(role);
window.handleCheckout = role => Attendance.handleCheckout(role);
window.toggleBreak = (role, type, dur) => Attendance.toggleBreak(role, type, dur);
window.submitDailyReport = role => Attendance.submitDailyReport(role);
window.submitLeaveRequest = () => Attendance.submitLeaveRequest();
window.approveLeave = id => Attendance.approveLeave(id);
window.rejectLeave = id => Attendance.rejectLeave(id);

window.addEmployee = Admin.addEmployee;
window.editEmployee = Admin.editEmployee;
window.viewEmployee = Admin.viewEmployee;
window.searchEmployees = Admin.searchEmployees;
window.processPayroll = Admin.processPayroll;
window.postAnnouncement = Admin.postAnnouncement;
window.saveAdminSettings = Admin.saveAdminSettings;
window.saveShiftSettings = Admin.saveShiftSettings;
window.addHoliday = Admin.addHoliday;
window.exportAdminAttendance = Admin.exportAdminAttendance;
window.generateCSVReport = Admin.generateCSVReport;

window.saveProfile = Profile.saveProfile;
window.handleProfilePhotoUpload = Profile.handleProfilePhotoUpload;

window.sendChatMessage = () => Chat.sendChatMessage(UI.getCurrentDashboard());
window.selectChatRecipient = name => Chat.selectChatRecipient(name, UI.getCurrentDashboard());
window.handleChatKeyPress = e => {
    if (e.key === 'Enter') Chat.sendChatMessage(UI.getCurrentDashboard());
};

async function initDashboard(role) {
    await Attendance.refreshAttendanceStatus(role);
    await Render.syncTeamStatus(role);
    Render.updateRealTimeView();
    Render.renderActivityLog(role);
    await Render.renderHolidays(role);
    await Render.updateProfileUI(role);
    await Render.renderAnnouncements(role);
    await Render.renderAllReports();

    setInterval(async () => {
        updateTimers(role);
        if (new Date().getSeconds() % 10 === 0) {
            await Render.syncTeamStatus(role);
            Render.updateRealTimeView();
        }
    }, 1000);
}

function updateTimers(role) {
    const prefix = role === 'admin' ? 'adm' : role === 'manager' ? 'mgr' : 'emp';
    const clock = document.getElementById(`${prefix}CurrentTime`);
    if (clock) clock.textContent = new Date().toLocaleTimeString();

    const att = hrmsData.attendance[role];
    if (!att || att.status !== 'checked_in') return;

    const timer = document.getElementById(`${prefix}WorkTimer`);
    const status = document.getElementById(`${prefix}BreakStatus`);
    if (!timer || !att.checkinTimestamp) return;

    const now = Date.now();
    const start = att.checkinTimestamp;

    let breakTotal = 0;
    let activeBreak = null;
    (att.breaks || []).forEach(b => {
        if (b.endTime) breakTotal += (b.endTime - b.startTime);
        else activeBreak = b;
    });

    if (activeBreak) {
        timer.textContent = formatTimeDuration(now - activeBreak.startTime);
        timer.style.color = '#f59e0b';
        if (status) status.textContent = `On Break: ${activeBreak.type}`;
    } else {
        timer.textContent = formatTimeDuration(now - start - breakTotal);
        timer.style.color = '#10b981';
        if (status) status.textContent = '';
    }
}

window.addEventListener('storage', e => {
    if (e.key === 'hrms_data') {
        updateDataFromStorage();
        Render.updateRealTimeView();
    }
});

console.log('HRMS Module System Initialized');
