import { hrmsData, saveData } from '../store/data.js';
import { api } from '../services/api.js';

export async function saveProfile(role) {
    const prefix = role === 'admin' ? 'adm' : role === 'manager' ? 'mgr' : 'emp';
    const payload = {
        name: document.getElementById(`${prefix}ProfileName`)?.value || '',
        email: document.getElementById(`${prefix}ProfileEmail`)?.value || '',
        phone: document.getElementById(`${prefix}ProfilePhone`)?.value || '',
        address: document.getElementById(`${prefix}ProfileAddress`)?.value || '',
        dob: document.getElementById(`${prefix}ProfileDOB`)?.value || '',
    };

    try {
        const updated = await api.updateProfile(payload);
        hrmsData.profiles[role] = {
            ...hrmsData.profiles[role],
            name: updated.name || payload.name,
            email: updated.email || payload.email,
            phone: updated.phone || payload.phone,
            address: updated.address || payload.address,
            dob: updated.dob || payload.dob,
            job: updated.jobTitle || hrmsData.profiles[role].job,
            dept: updated.department || hrmsData.profiles[role].dept,
            profileImageUrl: updated.profileImageUrl || hrmsData.profiles[role].profileImageUrl,
        };
        saveData();
        alert('Profile saved successfully.');
    } catch (error) {
        alert(error.message || 'Failed to save profile.');
    }
}

export async function handleProfilePhotoUpload(role, input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('File size too large (max 5MB)');
        return;
    }

    try {
        const data = await api.uploadProfilePhoto(file);
        hrmsData.profiles[role].profileImageUrl = data.profileImageUrl;
        saveData();

        const displayId = role === 'admin' ? 'admProfileImageDisplay' : role === 'manager' ? 'mgrProfileImageDisplay' : 'empProfileImageDisplay';
        const initialsId = role === 'admin' ? 'admProfileInitials' : role === 'manager' ? 'mgrProfileInitials' : 'empProfileInitials';

        const display = document.getElementById(displayId);
        const initials = document.getElementById(initialsId);

        if (display) {
            display.src = data.profileImageUrl;
            display.style.display = 'block';
        }
        if (initials) initials.style.display = 'none';

        alert('Photo uploaded.');
    } catch (error) {
        alert(error.message || 'Error uploading photo');
    }
}
