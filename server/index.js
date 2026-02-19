const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const validator = require('validator');

const app = express();

const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const REQUIRE_DAILY_REPORT = process.env.REQUIRE_DAILY_REPORT !== 'false';
const SHOULD_SEED_DEFAULT_USERS =
    process.env.SEED_DEFAULT_USERS === 'true' ||
    (process.env.SEED_DEFAULT_USERS !== 'false' && NODE_ENV !== 'production');

if (!JWT_SECRET) {
    throw new Error('Missing JWT_SECRET in server/.env');
}
if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in server/.env (MongoDB Atlas connection string)');
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(v => v.trim()),
    credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 500),
    standardHeaders: true,
    legacyHeaders: false,
}));

function utcDateKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
}

function toClockText(dateValue) {
    if (!dateValue) return '';
    return new Date(dateValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toDateText(dateValue) {
    if (!dateValue) return '';
    return new Date(dateValue).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 40 },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ['employee', 'manager', 'admin'] },
}, { timestamps: true });

const profileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true, required: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    dob: { type: String, trim: true, default: '' },
    jobTitle: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    manager: { type: String, trim: true, default: '' },
    profileImageUrl: { type: String, trim: true, default: '' },
}, { timestamps: true });

const attendanceSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    dateKey: { type: String, index: true, required: true },
    status: { type: String, enum: ['checked_in', 'checked_out'], default: 'checked_out' },
    checkinAt: { type: Date, default: null },
    checkoutAt: { type: Date, default: null },
    reportSubmitted: { type: Boolean, default: false },
    breaks: [{
        type: { type: String, required: true },
        startAt: { type: Date, required: true },
        endAt: { type: Date, default: null },
        limitMinutes: { type: Number, default: 0 },
    }],
}, { timestamps: true });
attendanceSchema.index({ user: 1, dateKey: 1 }, { unique: true });

const reportSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    dateKey: { type: String, index: true, required: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    imageUrl: { type: String, default: '' },
    attachments: [{ url: String, name: String, mimeType: String }],
    submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const leaveSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    type: { type: String, required: true, trim: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });

const chatMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    senderName: { type: String, required: true, trim: true },
    recipientType: { type: String, enum: ['group', 'direct'], required: true },
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    recipientLabel: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 3000 },
}, { timestamps: true });

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    msg: { type: String, required: true, trim: true, maxlength: 5000 },
    poster: { type: String, required: true, trim: true },
}, { timestamps: true });

const holidaySchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true },
    day: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['Public', 'National', 'Optional'], default: 'Public' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Profile = mongoose.model('Profile', profileSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Report = mongoose.model('Report', reportSchema);
const Leave = mongoose.model('Leave', leaveSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Holiday = mongoose.model('Holiday', holidaySchema);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const safeBase = file.originalname.replace(/[^\w.-]/g, '_');
        cb(null, `${Date.now()}-${safeBase}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 8 },
});

function sanitizeProfileUpdate(payload = {}) {
    const allowed = ['name', 'email', 'phone', 'address', 'dob', 'jobTitle', 'department', 'manager'];
    const out = {};
    for (const key of allowed) {
        if (payload[key] !== undefined) {
            out[key] = String(payload[key] ?? '').trim();
        }
    }
    if (out.email && !validator.isEmail(out.email)) {
        throw new HttpError(400, 'Invalid email address');
    }
    return out;
}

function roleGuard(...roles) {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new HttpError(403, 'Forbidden'));
        }
        return next();
    };
}

const authenticateToken = asyncHandler(async (req, _res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) throw new HttpError(401, 'Missing access token');

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (_e) {
        throw new HttpError(401, 'Invalid or expired token');
    }

    const user = await User.findById(payload.id).select('_id username role').lean();
    if (!user) throw new HttpError(401, 'User no longer exists');

    req.user = user;
    next();
});

async function ensureDefaultSeedData() {
    const userCount = await User.countDocuments();
    if (userCount > 0 || !SHOULD_SEED_DEFAULT_USERS) return;

    const defaults = [
        { username: 'employee', role: 'employee', password: process.env.DEFAULT_EMPLOYEE_PASSWORD || 'employee123', name: 'John Doe' },
        { username: 'manager', role: 'manager', password: process.env.DEFAULT_MANAGER_PASSWORD || 'manager123', name: 'Sarah Williams' },
        { username: 'admin', role: 'admin', password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', name: 'Robert Anderson' },
    ];

    for (const item of defaults) {
        const passwordHash = await bcrypt.hash(item.password, 12);
        const user = await User.create({
            username: item.username,
            passwordHash,
            role: item.role,
        });
        await Profile.create({
            user: user._id,
            name: item.name,
            email: `${item.username}@company.com`,
            jobTitle: item.role === 'admin' ? 'Administrator' : item.role === 'manager' ? 'Project Manager' : 'Software Engineer',
            department: item.role === 'admin' ? 'Administration' : 'Engineering',
        });
    }

    const holidayCount = await Holiday.countDocuments();
    if (holidayCount === 0) {
        await Holiday.insertMany([
            { date: '2026-01-01', day: 'Thursday', name: 'New Year Day', type: 'Public' },
            { date: '2026-01-26', day: 'Monday', name: 'Republic Day', type: 'National' },
            { date: '2026-05-01', day: 'Friday', name: 'Labour Day', type: 'Public' },
            { date: '2026-08-15', day: 'Saturday', name: 'Independence Day', type: 'National' },
            { date: '2026-12-25', day: 'Friday', name: 'Christmas', type: 'Public' },
        ]);
    }

    console.log('Seeded default users and holidays.');
}

async function getProfileByUserId(userId) {
    const profile = await Profile.findOne({ user: userId }).lean();
    return profile || {
        user: userId,
        name: '',
        email: '',
        phone: '',
        address: '',
        dob: '',
        jobTitle: '',
        department: '',
        manager: '',
        profileImageUrl: '',
    };
}

async function findUserByLabel(label) {
    const clean = String(label || '').trim();
    if (!clean) return null;
    const byUsername = await User.findOne({ username: clean.toLowerCase() }).select('_id').lean();
    if (byUsername) return byUsername;

    const profile = await Profile.findOne({ name: clean }).select('user').lean();
    if (!profile) return null;
    return { _id: profile.user };
}

function attendanceToApi(attendanceDoc) {
    if (!attendanceDoc) {
        return {
            status: 'checked_out',
            checkinTime: '',
            checkoutTime: '',
            checkinTimestamp: null,
            reportSubmitted: false,
            breaks: [],
        };
    }
    return {
        status: attendanceDoc.status,
        checkinTime: toClockText(attendanceDoc.checkinAt),
        checkoutTime: toClockText(attendanceDoc.checkoutAt),
        checkinTimestamp: attendanceDoc.checkinAt ? new Date(attendanceDoc.checkinAt).getTime() : null,
        reportSubmitted: !!attendanceDoc.reportSubmitted,
        breaks: (attendanceDoc.breaks || []).map(b => ({
            type: b.type,
            startTime: b.startAt ? new Date(b.startAt).getTime() : null,
            endTime: b.endAt ? new Date(b.endAt).getTime() : null,
            limit: b.limitMinutes || 0,
        })),
    };
}

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) throw new HttpError(400, 'Username and password are required');

    const user = await User.findOne({ username });
    if (!user) throw new HttpError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new HttpError(401, 'Invalid credentials');

    const profile = await getProfileByUserId(user._id);
    const token = jwt.sign(
        { id: user._id.toString(), username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
        token,
        user: {
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            name: profile.name || user.username,
        },
    });
}));

app.get('/api/auth/me', authenticateToken, asyncHandler(async (req, res) => {
    const profile = await getProfileByUserId(req.user._id);
    res.json({
        id: req.user._id.toString(),
        username: req.user.username,
        role: req.user.role,
        name: profile.name || req.user.username,
    });
}));

app.get('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
    const profile = await getProfileByUserId(req.user._id);
    res.json(profile);
}));

app.put('/api/profile', authenticateToken, asyncHandler(async (req, res) => {
    const updates = sanitizeProfileUpdate(req.body);
    const profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { $set: updates },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
}));

app.post('/api/profile/photo', authenticateToken, upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Image file is required');
    if (!req.file.mimetype.startsWith('image/')) {
        throw new HttpError(400, 'Only image files are allowed');
    }
    const profileImageUrl = `/uploads/${req.file.filename}`;
    const profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { $set: { profileImageUrl } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ profileImageUrl: profile.profileImageUrl });
}));

app.get('/api/attendance/status', authenticateToken, asyncHandler(async (req, res) => {
    const today = utcDateKey();
    const attendance = await Attendance.findOne({ user: req.user._id, dateKey: today }).lean();
    res.json(attendanceToApi(attendance));
}));

app.post('/api/attendance/checkin', authenticateToken, asyncHandler(async (req, res) => {
    const now = new Date();
    const today = utcDateKey(now);

    let attendance = await Attendance.findOne({ user: req.user._id, dateKey: today });
    if (attendance && attendance.status === 'checked_in' && !attendance.checkoutAt) {
        throw new HttpError(409, 'Already checked in for today');
    }

    if (!attendance) {
        attendance = new Attendance({
            user: req.user._id,
            dateKey: today,
        });
    }

    attendance.status = 'checked_in';
    attendance.checkinAt = now;
    attendance.checkoutAt = null;
    attendance.breaks = [];
    attendance.reportSubmitted = false;
    await attendance.save();

    res.json({
        message: 'Checked in',
        ...attendanceToApi(attendance),
    });
}));

app.post('/api/attendance/checkout', authenticateToken, asyncHandler(async (req, res) => {
    const now = new Date();
    const today = utcDateKey(now);
    const attendance = await Attendance.findOne({ user: req.user._id, dateKey: today });

    if (!attendance || attendance.status !== 'checked_in') {
        throw new HttpError(409, 'You are not checked in');
    }

    const activeBreak = (attendance.breaks || []).find(b => !b.endAt);
    if (activeBreak) throw new HttpError(400, 'End current break before checkout');
    if (REQUIRE_DAILY_REPORT && !attendance.reportSubmitted) {
        throw new HttpError(400, 'Submit daily report before checkout');
    }

    attendance.status = 'checked_out';
    attendance.checkoutAt = now;
    await attendance.save();

    res.json({
        message: 'Checked out',
        ...attendanceToApi(attendance),
    });
}));

app.post('/api/attendance/break/start', authenticateToken, asyncHandler(async (req, res) => {
    const type = String(req.body.type || '').trim();
    const limitMinutes = Number(req.body.limitMinutes || 0);
    if (!type) throw new HttpError(400, 'Break type is required');

    const attendance = await Attendance.findOne({ user: req.user._id, dateKey: utcDateKey() });
    if (!attendance || attendance.status !== 'checked_in') {
        throw new HttpError(409, 'You must check in first');
    }

    const activeBreak = attendance.breaks.find(b => !b.endAt);
    if (activeBreak) throw new HttpError(409, `Already on ${activeBreak.type} break`);

    attendance.breaks.push({
        type,
        startAt: new Date(),
        limitMinutes: Number.isFinite(limitMinutes) ? limitMinutes : 0,
    });
    await attendance.save();
    res.json({ message: 'Break started', ...attendanceToApi(attendance) });
}));

app.post('/api/attendance/break/end', authenticateToken, asyncHandler(async (req, res) => {
    const attendance = await Attendance.findOne({ user: req.user._id, dateKey: utcDateKey() });
    if (!attendance || attendance.status !== 'checked_in') {
        throw new HttpError(409, 'You must check in first');
    }

    const activeBreak = attendance.breaks.find(b => !b.endAt);
    if (!activeBreak) throw new HttpError(409, 'No active break');
    activeBreak.endAt = new Date();

    await attendance.save();
    res.json({ message: 'Break ended', ...attendanceToApi(attendance) });
}));

app.get('/api/attendance/history', authenticateToken, asyncHandler(async (req, res) => {
    const query = {};
    if (req.user.role === 'employee') {
        query.user = req.user._id;
    } else if (req.query.userId) {
        query.user = req.query.userId;
    }
    if (req.query.fromDate || req.query.toDate) {
        query.dateKey = {};
        if (req.query.fromDate) query.dateKey.$gte = String(req.query.fromDate);
        if (req.query.toDate) query.dateKey.$lte = String(req.query.toDate);
    }

    const rows = await Attendance.find(query).sort({ dateKey: -1 }).limit(120).lean();
    res.json(rows.map(attendanceToApi));
}));

app.post('/api/reports', authenticateToken, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
]), asyncHandler(async (req, res) => {
    const content = String(req.body.content || '').trim();
    if (!content) throw new HttpError(400, 'Report content is required');

    const files = req.files || {};
    const imageFile = files.image?.[0];
    if (imageFile && !imageFile.mimetype.startsWith('image/')) {
        throw new HttpError(400, 'Image must be an image file');
    }

    const attachmentFiles = files.attachments || [];
    const attachments = attachmentFiles.map(file => ({
        url: `/uploads/${file.filename}`,
        name: file.originalname,
        mimeType: file.mimetype,
    }));

    const now = new Date();
    const today = utcDateKey(now);

    const report = await Report.create({
        user: req.user._id,
        dateKey: today,
        content,
        imageUrl: imageFile ? `/uploads/${imageFile.filename}` : '',
        attachments,
        submittedAt: now,
    });

    await Attendance.findOneAndUpdate(
        { user: req.user._id, dateKey: today },
        { $set: { reportSubmitted: true } },
        { upsert: true }
    );

    res.status(201).json({
        id: report._id.toString(),
        date: toDateText(report.submittedAt),
        time: toClockText(report.submittedAt),
        content: report.content,
        imageUrl: report.imageUrl,
        attachments: report.attachments,
    });
}));

app.get('/api/reports', authenticateToken, asyncHandler(async (req, res) => {
    const query = {};
    if (req.user.role === 'employee') {
        query.user = req.user._id;
    }

    const reports = await Report.find(query).sort({ submittedAt: -1 }).limit(300).lean();
    const userIds = [...new Set(reports.map(r => String(r.user)))];
    const profiles = await Profile.find({ user: { $in: userIds } }).select('user name').lean();
    const profileByUser = new Map(profiles.map(p => [String(p.user), p.name]));

    const payload = reports.map(r => ({
        id: r._id.toString(),
        date: toDateText(r.submittedAt),
        time: toClockText(r.submittedAt),
        employee: profileByUser.get(String(r.user)) || 'Unknown',
        content: r.content,
        imageUrl: r.imageUrl || '',
        attachments: r.attachments || [],
    }));
    res.json(payload);
}));

app.post('/api/leaves', authenticateToken, asyncHandler(async (req, res) => {
    const type = String(req.body.type || '').trim();
    const fromDate = String(req.body.fromDate || '').trim();
    const toDate = String(req.body.toDate || '').trim();
    const reason = String(req.body.reason || '').trim();

    if (!type || !fromDate || !toDate || !reason) {
        throw new HttpError(400, 'type, fromDate, toDate and reason are required');
    }

    const leave = await Leave.create({
        user: req.user._id,
        type,
        fromDate,
        toDate,
        reason,
    });
    res.status(201).json(leave);
}));

app.get('/api/leaves', authenticateToken, asyncHandler(async (req, res) => {
    const query = req.user.role === 'employee' ? { user: req.user._id } : {};
    const leaves = await Leave.find(query).sort({ createdAt: -1 }).limit(500).lean();

    const userIds = [...new Set(leaves.map(l => String(l.user)))];
    const profiles = await Profile.find({ user: { $in: userIds } }).select('user name').lean();
    const nameByUser = new Map(profiles.map(p => [String(p.user), p.name]));

    const data = leaves.map(l => ({
        id: l._id.toString(),
        employee: nameByUser.get(String(l.user)) || 'Unknown',
        type: l.type,
        from: l.fromDate,
        to: l.toDate,
        reason: l.reason,
        status: l.status,
        timestamp: new Date(l.createdAt).toLocaleString(),
    }));
    res.json(data);
}));

app.patch('/api/leaves/:id/status', authenticateToken, roleGuard('manager', 'admin'), asyncHandler(async (req, res) => {
    const status = String(req.body.status || '').trim();
    if (!['Approved', 'Rejected'].includes(status)) {
        throw new HttpError(400, 'Status must be Approved or Rejected');
    }

    const leave = await Leave.findByIdAndUpdate(
        req.params.id,
        { $set: { status, reviewedBy: req.user._id, reviewedAt: new Date() } },
        { new: true }
    );
    if (!leave) throw new HttpError(404, 'Leave request not found');
    res.json({ id: leave._id.toString(), status: leave.status });
}));

app.get('/api/chat/messages', authenticateToken, asyncHandler(async (req, res) => {
    const recipient = String(req.query.recipient || 'Group Chat').trim();
    const myProfile = await getProfileByUserId(req.user._id);
    const myLabel = myProfile.name || req.user.username;

    let query;
    if (recipient.toLowerCase() === 'group chat') {
        query = { recipientType: 'group', recipientLabel: 'Group Chat' };
    } else {
        const recipientUser = await findUserByLabel(recipient);
        if (!recipientUser) throw new HttpError(404, 'Recipient not found');
        query = {
            recipientType: 'direct',
            $or: [
                { sender: req.user._id, recipientUser: recipientUser._id },
                { sender: recipientUser._id, recipientUser: req.user._id },
                { senderName: recipient, recipientLabel: myLabel },
            ],
        };
    }

    const messages = await ChatMessage.find(query).sort({ createdAt: 1 }).limit(500).lean();
    res.json(messages.map(m => ({
        id: m._id.toString(),
        sender: m.senderName,
        recipient: m.recipientLabel,
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(m.createdAt).getTime(),
    })));
}));

app.post('/api/chat/messages', authenticateToken, asyncHandler(async (req, res) => {
    const recipient = String(req.body.recipient || '').trim();
    const text = String(req.body.text || '').trim();
    if (!recipient || !text) throw new HttpError(400, 'recipient and text are required');

    const myProfile = await getProfileByUserId(req.user._id);
    const senderName = myProfile.name || req.user.username;

    let recipientType = 'group';
    let recipientUser = null;
    let recipientLabel = 'Group Chat';

    if (recipient.toLowerCase() !== 'group chat') {
        const targetUser = await findUserByLabel(recipient);
        if (!targetUser) throw new HttpError(404, 'Recipient not found');
        recipientType = 'direct';
        recipientUser = targetUser._id;
        recipientLabel = recipient;
    }

    const msg = await ChatMessage.create({
        sender: req.user._id,
        senderName,
        recipientType,
        recipientUser,
        recipientLabel,
        text,
    });

    res.status(201).json({
        id: msg._id.toString(),
        sender: msg.senderName,
        recipient: msg.recipientLabel,
        text: msg.text,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(msg.createdAt).getTime(),
    });
}));

app.get('/api/team/status', authenticateToken, roleGuard('manager', 'admin'), asyncHandler(async (req, res) => {
    const scopeRoles = req.user.role === 'admin' ? ['employee', 'manager', 'admin'] : ['employee', 'manager'];
    const users = await User.find({ role: { $in: scopeRoles } }).select('_id role username').lean();
    const profiles = await Profile.find({ user: { $in: users.map(u => u._id) } }).select('user name').lean();
    const profileByUser = new Map(profiles.map(p => [String(p.user), p.name]));

    const today = utcDateKey();
    const todayAttendance = await Attendance.find({ user: { $in: users.map(u => u._id) }, dateKey: today }).lean();
    const attendanceByUser = new Map(todayAttendance.map(a => [String(a.user), a]));

    const data = users.map(user => {
        const att = attendanceByUser.get(String(user._id));
        let status = 'Absent';
        let statusClass = 'absent';
        let time = '';

        if (att && att.status === 'checked_in') {
            const activeBreak = (att.breaks || []).find(b => !b.endAt);
            if (activeBreak) {
                status = `Break: ${activeBreak.type}`;
                statusClass = 'pending';
                time = toClockText(activeBreak.startAt);
            } else {
                status = 'Online';
                statusClass = 'present';
                time = toClockText(att.checkinAt);
            }
        } else if (att && att.checkoutAt) {
            status = 'Checked Out';
            statusClass = 'absent';
            time = toClockText(att.checkoutAt);
        }

        return {
            name: profileByUser.get(String(user._id)) || user.username,
            role: user.role,
            status,
            statusClass,
            time,
            location: 'Office',
        };
    });

    res.json(data);
}));

app.get('/api/announcements', authenticateToken, asyncHandler(async (_req, res) => {
    const list = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(list.map(a => ({
        id: a._id.toString(),
        title: a.title,
        msg: a.msg,
        poster: a.poster,
        date: toDateText(a.createdAt),
    })));
}));

app.post('/api/announcements', authenticateToken, roleGuard('admin'), asyncHandler(async (req, res) => {
    const title = String(req.body.title || '').trim();
    const msg = String(req.body.msg || '').trim();
    if (!title || !msg) throw new HttpError(400, 'title and msg are required');

    const profile = await getProfileByUserId(req.user._id);
    const created = await Announcement.create({
        title,
        msg,
        poster: profile.name || req.user.username,
    });
    res.status(201).json({
        id: created._id.toString(),
        title: created.title,
        msg: created.msg,
        poster: created.poster,
        date: toDateText(created.createdAt),
    });
}));

app.get('/api/holidays', authenticateToken, asyncHandler(async (_req, res) => {
    const holidays = await Holiday.find().sort({ date: 1 }).lean();
    res.json(holidays);
}));

app.post('/api/holidays', authenticateToken, roleGuard('admin'), asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const date = String(req.body.date || '').trim();
    const type = String(req.body.type || 'Public').trim();
    if (!name || !date) throw new HttpError(400, 'name and date are required');

    const day = req.body.day ? String(req.body.day).trim() : new Date(date).toLocaleDateString([], { weekday: 'long' });
    const holiday = await Holiday.findOneAndUpdate(
        { date },
        { $set: { name, date, day, type } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(holiday);
}));

app.get('/api/admin/employees', authenticateToken, roleGuard('manager', 'admin'), asyncHandler(async (_req, res) => {
    const users = await User.find().select('_id username role').sort({ createdAt: -1 }).lean();
    const profiles = await Profile.find({ user: { $in: users.map(u => u._id) } }).lean();
    const profileByUser = new Map(profiles.map(p => [String(p.user), p]));

    const data = users.map(u => {
        const p = profileByUser.get(String(u._id)) || {};
        return {
            id: u._id.toString(),
            username: u.username,
            role: u.role,
            name: p.name || '',
            email: p.email || '',
            phone: p.phone || '',
            department: p.department || '',
            jobTitle: p.jobTitle || '',
        };
    });
    res.json(data);
}));

app.post('/api/admin/employees', authenticateToken, roleGuard('admin'), asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const role = String(req.body.role || 'employee').trim();
    const name = String(req.body.name || '').trim();

    if (!username || !password || !role) {
        throw new HttpError(400, 'username, password and role are required');
    }
    if (!['employee', 'manager', 'admin'].includes(role)) {
        throw new HttpError(400, 'Invalid role');
    }

    const exists = await User.findOne({ username }).lean();
    if (exists) throw new HttpError(409, 'Username already exists');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, passwordHash, role });
    await Profile.create({
        user: user._id,
        name: name || username,
        email: String(req.body.email || '').trim(),
        phone: String(req.body.phone || '').trim(),
        department: String(req.body.department || '').trim(),
        jobTitle: String(req.body.jobTitle || '').trim(),
    });

    res.status(201).json({
        id: user._id.toString(),
        username: user.username,
        role: user.role,
    });
}));

app.put('/api/admin/employees/:id', authenticateToken, roleGuard('admin'), asyncHandler(async (req, res) => {
    const updates = {};
    if (req.body.role && ['employee', 'manager', 'admin'].includes(req.body.role)) {
        updates.role = req.body.role;
    }
    if (req.body.password) {
        updates.passwordHash = await bcrypt.hash(String(req.body.password), 12);
    }

    if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(req.params.id, { $set: updates });
    }

    const profileUpdates = sanitizeProfileUpdate(req.body);
    if (Object.keys(profileUpdates).length > 0) {
        await Profile.findOneAndUpdate(
            { user: req.params.id },
            { $set: profileUpdates },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    res.json({ success: true });
}));

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, env: NODE_ENV, timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    if (status >= 500) {
        console.error(err);
    }
    res.status(status).json({ error: message });
});

async function startServer() {
    await mongoose.connect(MONGODB_URI, {
        dbName: MONGODB_DB_NAME || undefined,
    });
    console.log('Connected to MongoDB Atlas');
    await ensureDefaultSeedData();

    if (NODE_ENV === 'production') {
        const distDir = path.join(__dirname, '..', 'dist');
        if (fs.existsSync(distDir)) {
            app.use(express.static(distDir));
            app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
        }
    }

    app.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
