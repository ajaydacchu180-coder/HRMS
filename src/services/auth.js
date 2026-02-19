/**
 * Authentication service backed by REST API
 */
import { api } from './api.js';

class AuthService {
    async login(role, username, password) {
        try {
            const data = await api.login(username, password);
            if (data.user.role !== role) {
                alert(`Security Warning: You logged in as ${data.user.role}, but selected ${role} role.`);
            }
            localStorage.setItem('hrms_user', JSON.stringify(data.user));
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    logout() {
        api.setToken(null);
        localStorage.removeItem('hrms_user');
    }
}
export const authService = new AuthService();
