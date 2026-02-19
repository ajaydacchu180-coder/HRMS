import { hrmsData, saveData } from '../store/data.js';
import { escapeHTML } from '../utils/helpers.js';
import { api } from '../services/api.js';

let activeRecipient = 'Group Chat';

function rolePrefix(role) {
    return role === 'admin' ? 'adm' : role === 'manager' ? 'mgr' : 'emp';
}

export async function initChat(role) {
    renderChatSidebar(role);
    await renderChatMessages(role);
}

export function renderChatSidebar(role) {
    const listId = `${rolePrefix(role)}ChatUserList`;
    const list = document.getElementById(listId);
    if (!list) return;

    const users = [
        { name: 'Group Chat', role: 'group', icon: '👥' },
        { name: 'Robert Anderson', role: 'admin', icon: '⚙️' },
        { name: 'Sarah Williams', role: 'manager', icon: '👔' },
        { name: 'John Doe', role: 'employee', icon: '👤' }
    ];

    list.innerHTML = users.map(user => `
        <div class="user-item ${activeRecipient === user.name ? 'active' : ''}" 
             onclick="window.selectChatRecipient('${user.name}')">
            <div class="user-icon">${user.icon}</div>
            <div class="user-name">${user.name}</div>
        </div>
    `).join('');
}

export async function selectChatRecipient(name, role) {
    activeRecipient = name;
    const activeUserTitleId = `${rolePrefix(role)}ChatActiveUser`;
    const title = document.getElementById(activeUserTitleId);
    if (title) title.textContent = name;
    renderChatSidebar(role);
    await renderChatMessages(role);
}

export async function sendChatMessage(role) {
    const inputId = `${rolePrefix(role)}ChatInput`;
    const input = document.getElementById(inputId);
    const text = input?.value?.trim();
    if (!text) return;

    try {
        await api.sendChatMessage(activeRecipient, text);
        input.value = '';
        await renderChatMessages(role);
    } catch (error) {
        alert(error.message || 'Failed to send message');
    }
}

export async function renderChatMessages(role) {
    const areaId = `${rolePrefix(role)}ChatMessageArea`;
    const area = document.getElementById(areaId);
    if (!area) return;

    try {
        const messages = await api.getChatMessages(activeRecipient);
        hrmsData.chatMessages = messages;
        saveData();
    } catch (error) {
        console.error('Chat fetch failed:', error);
    }

    const profile = hrmsData.profiles[role] || { name: '' };
    const messages = (hrmsData.chatMessages || []).map(m => ({
        ...m,
        recipient: m.recipient || activeRecipient,
    }));

    area.innerHTML = messages.map(m => `
        <div class="chat-message ${m.sender === profile.name ? 'sent' : 'received'}">
            <div class="message-info">
                <span class="sender">${escapeHTML(m.sender)}</span>
                <span class="time">${escapeHTML(m.time || '')}</span>
            </div>
            <div class="message-text">${escapeHTML(m.text)}</div>
        </div>
    `).join('');
    area.scrollTop = area.scrollHeight;
}
