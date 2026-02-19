/**
 * UI State and Component Management
 */

let currentDashboard = '';

export function getCurrentDashboard() {
    return currentDashboard;
}

export function setCurrentDashboard(role) {
    currentDashboard = role;
}

export function selectRole(role) {
    document.querySelectorAll('.role-option').forEach(opt => opt.classList.remove('selected'));
    const roleOpt = document.getElementById(`role-${role}`);
    if (roleOpt) roleOpt.classList.add('selected');
    window.selectedRole = role; // Still globally available for now
}

export function switchTab(dashboard, tabId) {
    const panels = document.querySelectorAll(`#${dashboard}Dashboard .tab-panel`);
    panels.forEach(panel => panel.classList.remove('active'));

    const tabs = document.querySelectorAll(`#${dashboard}Dashboard .nav-tab`);
    tabs.forEach(tab => tab.classList.remove('active'));

    const tabElement = document.getElementById(tabId);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    if (window.event && window.event.target && window.event.target.classList.contains('nav-tab')) {
        window.event.target.classList.add('active');
    }

}

export function switchSubTab(prefix, subTab) {
    const panel = document.getElementById(`${prefix}-sub-${subTab}`);
    if (!panel) return;

    const parent = panel.parentElement;
    parent.querySelectorAll(`[id^="${prefix}-sub-"]`).forEach(p => {
        p.style.display = 'none';
    });
    if (panel) panel.style.display = 'block';

    // Update buttons by active text match, independent of btn class
    const nav = panel.parentElement.querySelector('.sub-tab-nav');
    if (nav) {
        const buttons = Array.from(nav.querySelectorAll('button'));
        buttons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        const activeBtn = buttons.find(b => b.textContent.toLowerCase().includes(subTab));
        if (activeBtn) {
            activeBtn.classList.remove('btn-secondary');
            activeBtn.classList.add('btn-primary');
        }
    }
}

export function toggleSidebar() {
    const activeDashboard = document.querySelector('.dashboard.active');
    if (activeDashboard) {
        const nav = activeDashboard.querySelector('.dashboard-nav');
        if (nav) {
            nav.classList.toggle('mobile-active');
        }
    }
}

export function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}
