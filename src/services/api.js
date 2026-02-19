const API_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

class ApiService {
    constructor() {
        this.token = localStorage.getItem('hrms_token');
    }

    setToken(token) {
        this.token = token;
        if (token) localStorage.setItem('hrms_token', token);
        else localStorage.removeItem('hrms_token');
    }

    getToken() {
        return this.token || localStorage.getItem('hrms_token');
    }

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            ...(options.headers || {}),
        };

        if (token) headers.Authorization = `Bearer ${token}`;
        const isFormData = options.body instanceof FormData;
        if (!isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: options.method || 'GET',
            headers,
            body: options.body,
        });

        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await response.json()
            : await response.text();

        if (response.status === 401) {
            this.setToken(null);
            localStorage.removeItem('hrms_user');
        }

        if (!response.ok) {
            const message = typeof payload === 'string'
                ? payload
                : payload?.error || 'Request failed';
            throw new Error(message);
        }

        return payload;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        if (data.token) this.setToken(data.token);
        return data;
    }

    async getMe() {
        return this.request('/auth/me');
    }

    async getProfile() {
        return this.request('/profile');
    }

    async updateProfile(payload) {
        return this.request('/profile', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }

    async uploadProfilePhoto(file) {
        const form = new FormData();
        form.append('image', file);
        return this.request('/profile/photo', {
            method: 'POST',
            body: form,
        });
    }

    async checkin() {
        return this.request('/attendance/checkin', { method: 'POST' });
    }

    async checkout() {
        return this.request('/attendance/checkout', { method: 'POST' });
    }

    async getStatus() {
        return this.request('/attendance/status');
    }

    async startBreak(type, limitMinutes = 0) {
        return this.request('/attendance/break/start', {
            method: 'POST',
            body: JSON.stringify({ type, limitMinutes }),
        });
    }

    async endBreak() {
        return this.request('/attendance/break/end', { method: 'POST' });
    }

    async getAttendanceHistory(params = {}) {
        const search = new URLSearchParams(params);
        const query = search.toString();
        return this.request(`/attendance/history${query ? `?${query}` : ''}`);
    }

    async submitReport({ content, imageFile, attachmentFiles = [] }) {
        const form = new FormData();
        form.append('content', content);
        if (imageFile) form.append('image', imageFile);
        attachmentFiles.forEach(file => form.append('attachments', file));
        return this.request('/reports', {
            method: 'POST',
            body: form,
        });
    }

    async getReports() {
        return this.request('/reports');
    }

    async submitLeave(payload) {
        return this.request('/leaves', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getLeaves() {
        return this.request('/leaves');
    }

    async updateLeaveStatus(id, status) {
        return this.request(`/leaves/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    }

    async getChatMessages(recipient) {
        const query = new URLSearchParams({ recipient: recipient || 'Group Chat' });
        return this.request(`/chat/messages?${query.toString()}`);
    }

    async sendChatMessage(recipient, text) {
        return this.request('/chat/messages', {
            method: 'POST',
            body: JSON.stringify({ recipient, text }),
        });
    }

    async getTeamStatus() {
        return this.request('/team/status');
    }

    async getAnnouncements() {
        return this.request('/announcements');
    }

    async createAnnouncement(payload) {
        return this.request('/announcements', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getHolidays() {
        return this.request('/holidays');
    }

    async createHoliday(payload) {
        return this.request('/holidays', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getEmployees() {
        return this.request('/admin/employees');
    }

    async createEmployee(payload) {
        return this.request('/admin/employees', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async updateEmployee(id, payload) {
        return this.request(`/admin/employees/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }
}

export const api = new ApiService();
