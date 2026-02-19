/**
 * Central Data Store and Persistence
 */
export const DATA_KEY = 'hrms_data';

export function getInitialData() {
    return {
        attendance: {
            employee: { status: 'checked_out', checkinTime: null, checkinTimestamp: null, breaks: [], reportSubmitted: false },
            manager: { status: 'checked_out', checkinTime: null, checkinTimestamp: null, breaks: [], reportSubmitted: false },
            admin: { status: 'checked_out', checkinTime: null, checkinTimestamp: null, breaks: [], reportSubmitted: false }
        },
        activityLog: [],
        reports: [],
        employeeStatus: {},
        chatMessages: [],
        leaves: [],
        announcements: [],
        profiles: {
            employee: { name: 'John Doe', email: 'john.doe@company.com', phone: '', address: '', dob: '', dept: 'Development', job: 'Senior Developer', profileImageUrl: '' },
            manager: { name: 'Sarah Williams', email: 'sarah.w@company.com', phone: '', address: '', dob: '', dept: 'Development', job: 'Project Manager', profileImageUrl: '' },
            admin: { name: 'Robert Anderson', email: 'robert.a@company.com', phone: '', address: '', dob: '', dept: 'Administration', job: 'System Architect', profileImageUrl: '' }
        },
        holidays: [
            { date: '2026-01-01', day: 'Thursday', name: 'New Year Day', type: 'Public' },
            { date: '2026-01-26', day: 'Monday', name: 'Republic Day', type: 'National' },
            { date: '2026-03-15', day: 'Sunday', name: 'Holi', type: 'Public' },
            { date: '2026-05-01', day: 'Friday', name: 'Labour Day', type: 'Public' },
            { date: '2026-08-15', day: 'Saturday', name: 'Independence Day', type: 'National' },
            { date: '2026-10-02', day: 'Friday', name: 'Gandhi Jayanti', type: 'National' },
            { date: '2026-12-25', day: 'Friday', name: 'Christmas', type: 'Public' }
        ],
        shiftTimings: {
            employee: { start: '09:00', end: '18:00' },
            manager: { start: '09:00', end: '18:00' }
        },
        timelines: [],
        notifications: [],
        tasks: [],
        settings: {
            companyName: 'TRINIX IT SOLUTIONS Pvt.Ltd',
            workHours: 9,
            leavePolicy: { sl: 12, cl: 15, el: 20 }
        }
    };
}

export let hrmsData;

export function initData() {
    try {
        const stored = localStorage.getItem(DATA_KEY);
        if (stored) {
            hrmsData = JSON.parse(stored);
            const defaults = getInitialData();
            // Deep merge or check missing keys
            Object.keys(defaults).forEach(key => {
                if (hrmsData[key] === undefined) {
                    hrmsData[key] = defaults[key];
                }
            });
        } else {
            hrmsData = getInitialData();
            saveData();
        }
    } catch (e) {
        console.error("Data corruption detected, resetting store:", e);
        hrmsData = getInitialData();
        saveData();
    }
}

export function saveData() {
    localStorage.setItem(DATA_KEY, JSON.stringify(hrmsData));
}

export function updateDataFromStorage() {
    try {
        const freshData = JSON.parse(localStorage.getItem(DATA_KEY));
        if (freshData) {
            hrmsData = freshData;
        }
    } catch (e) {
        console.error("Sync error", e);
    }
}

initData();
