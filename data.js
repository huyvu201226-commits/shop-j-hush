// ============================================================
// data.js — Lớp truy xuất dữ liệu dùng chung cho toàn hệ thống
// Dùng chung bởi script.js (trang khách) và admin.js (trang quản trị)
// ============================================================

const STORAGE_KEYS = {
    accounts: 'jh_accounts',
    settings: 'jh_settings',
    deviceCode: 'jh_device_code',
    activityLog: 'jh_activity_log'
};

// Tiền tố đánh dấu một trường ảnh/nhạc đang trỏ tới file lưu trong IndexedDB
// thay vì một URL bình thường, ví dụ: "idb:acc_img_173..." 
const IDB_PREFIX = 'idb:';

const DEFAULT_ACCOUNTS = [
    { id: 1, code: "JH-01", name: "Acc Liên Quân Siêu VIP 50 Tướng", price: 350000, category: "mid", status: "selling", img: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300" },
    { id: 2, code: "JH-02", name: "Acc FreeFire Full Skin Súng 99k", price: 99000, category: "cheap", status: "selling", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300" },
    { id: 3, code: "JH-03", name: "Acc VIP Đột Kích Cực Khủng", price: 1200000, category: "high", status: "selling", img: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=300" },
    { id: 4, code: "JH-04", name: "Acc Tốc Chiến Rank Thách Đấu", price: 2500000, category: "expensive", status: "sold", img: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=300" }
];

const DEFAULT_LOGO = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100";

const DEFAULT_SETTINGS = {
    adminTitle: "J-HUSH / HUY ĐỨC",
    introText: "Chào cả nhà. Shop mk là buôn của các ad lớn (ad Công, Trâm ...vv) cọc ut và có ctv hơn 50 group.<br>- Mk buôn lên tương tác rộng ae nào cần tìm gì cứ ib mk 📩<br>- Có cân tg có check ut<br>- Hỗ trợ góp, tìm và lên đời acc (thuê acc trọn đời) 🔥<br>- Ae vào thì nhớ để mk một slot +kèo cân hết luôn 🥰<br>- Các dịch vụ khác liqi và ff<br><br><b>Lưu ý: Hãy là người gd thông minh 🫰</b><br>Theo dõi đồng hành cùng mk trên nền tảng khác nhớ...",
    bankName: "MB Bank",
    bankAcc: "0362062410",
    bankOwner: "VU HUY DUC",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    // Ảnh logo shop (navbar + màn chào) và ảnh đại diện admin (tab Giới thiệu).
    // Giá trị mặc định là URL; nếu admin tải ảnh từ máy lên, giá trị sẽ đổi thành "idb:...".
    logoUrl: DEFAULT_LOGO,
    avatarUrl: DEFAULT_LOGO,
    socialLinks: {
        tiktok: "https://www.tiktok.com/@j.hush06?_t=ZS-8wYxFErGfCi&_r=1",
        youtube: "https://www.youtube.com/channel/UCOy-qazssTHU3xxvhS6vx5Q",
        zalo: "https://zalo.me/0362062410",
        facebook: "" // để trống = hiển thị "Tạm khóa" như hiện tại
    },
    // Mật khẩu quản trị được băm (SHA-256 + salt), KHÔNG lưu plaintext trong code nữa.
    adminPasswordHash: null,
    adminPasswordSalt: null
};

// ------------------------------------------------------------
// Cache trong bộ nhớ: tránh gọi JSON.parse(localStorage.getItem(...))
// lặp lại nhiều lần trong cùng một phiên trang.
// ------------------------------------------------------------
let _accountsCache = null;
let _settingsCache = null;

function getAccounts() {
    if (_accountsCache) return _accountsCache;
    const raw = localStorage.getItem(STORAGE_KEYS.accounts);
    _accountsCache = raw ? JSON.parse(raw) : DEFAULT_ACCOUNTS.slice();
    if (!raw) localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(_accountsCache));
    return _accountsCache;
}

function saveAccounts(accounts) {
    _accountsCache = accounts;
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
}

function getSettings() {
    if (_settingsCache) return _settingsCache;
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    // Merge với DEFAULT_SETTINGS để các bản cũ (chưa có socialLinks, logoUrl...) tự nâng cấp êm.
    _settingsCache = raw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw), socialLinks: { ...DEFAULT_SETTINGS.socialLinks, ...(JSON.parse(raw).socialLinks || {}) } }
        : { ...DEFAULT_SETTINGS };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(_settingsCache));
    return _settingsCache;
}

function saveSettings(settings) {
    _settingsCache = settings;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function getOrCreateDeviceCode() {
    let code = localStorage.getItem(STORAGE_KEYS.deviceCode);
    if (!code) {
        code = 'JH-DISC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem(STORAGE_KEYS.deviceCode, code);
    }
    return code;
}

function formatVND(amount) {
    return Number(amount).toLocaleString('vi-VN') + 'đ';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function formatDateTime(ts) {
    return new Date(ts).toLocaleString('vi-VN');
}

// ============================================================
// LƯU TRỮ FILE NHỊ PHÂN (ảnh acc, logo, avatar, nhạc nền) — dùng IndexedDB
// thay vì localStorage vì dung lượng lớn hơn nhiều (localStorage chỉ ~5MB
// và phải mã hoá base64 tốn thêm ~33% dung lượng).
// ============================================================
const FILES_DB_NAME = 'jh_files_db';
const FILES_STORE = 'files';
let _dbPromise = null;

function openFilesDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(FILES_DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(FILES_STORE)) {
                db.createObjectStore(FILES_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

async function saveFileBlob(key, blob) {
    const db = await openFilesDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(FILES_STORE, 'readwrite');
        tx.objectStore(FILES_STORE).put({ key, blob, updatedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    invalidateObjectURL(key);
}

async function getFileBlob(key) {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILES_STORE, 'readonly');
        const req = tx.objectStore(FILES_STORE).get(key);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => reject(req.error);
    });
}

async function deleteFileBlob(key) {
    const db = await openFilesDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(FILES_STORE, 'readwrite');
        tx.objectStore(FILES_STORE).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    invalidateObjectURL(key);
}

// Cache Object URL theo key để không tạo lại (và rò rỉ bộ nhớ) mỗi lần render
const _objectUrlCache = new Map();

async function getFileObjectURL(key) {
    if (_objectUrlCache.has(key)) return _objectUrlCache.get(key);
    const blob = await getFileBlob(key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _objectUrlCache.set(key, url);
    return url;
}

function invalidateObjectURL(key) {
    const old = _objectUrlCache.get(key);
    if (old) URL.revokeObjectURL(old);
    _objectUrlCache.delete(key);
}

// Chuyển 1 field ảnh/nhạc (có thể là URL thường hoặc "idb:key") thành src dùng được trực tiếp
async function resolveMediaSrc(field, fallback) {
    if (field && field.startsWith(IDB_PREFIX)) {
        const url = await getFileObjectURL(field.slice(IDB_PREFIX.length));
        return url || fallback;
    }
    return field || fallback;
}

// Lưu 1 File (từ <input type="file">) vào IndexedDB và trả về field dạng "idb:key" để lưu vào settings/account
async function storeUploadedFile(file, keyPrefix) {
    const key = `${keyPrefix}_${Date.now()}`;
    await saveFileBlob(key, file);
    return IDB_PREFIX + key;
}

// ============================================================
// MẬT KHẨU QUẢN TRỊ — băm SHA-256 + salt ngẫu nhiên, không còn để plaintext trong code.
// Lưu ý: đây vẫn là kiểm tra phía trình duyệt (client-side), người dùng rành kỹ thuật
// vẫn có thể sửa sessionStorage bằng DevTools để giả lập đăng nhập. Muốn bảo mật thật sự
// cần xác thực phía máy chủ (server) — xem ghi chú cuối cuộc trò chuyện.
// ============================================================
function generateSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
    const enc = new TextEncoder().encode(salt + ':' + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Đảm bảo luôn có 1 mật khẩu hợp lệ; nếu chưa từng đặt, khởi tạo mặc định "admin123"
async function ensureAdminPasswordInitialized() {
    const settings = getSettings();
    if (!settings.adminPasswordHash || !settings.adminPasswordSalt) {
        const salt = generateSalt();
        settings.adminPasswordSalt = salt;
        settings.adminPasswordHash = await hashPassword('admin123', salt);
        saveSettings(settings);
    }
    return settings;
}

async function verifyPassword(inputPassword) {
    const settings = await ensureAdminPasswordInitialized();
    const hash = await hashPassword(inputPassword, settings.adminPasswordSalt);
    return hash === settings.adminPasswordHash;
}

async function changeAdminPassword(newPassword) {
    const settings = getSettings();
    const salt = generateSalt();
    settings.adminPasswordSalt = salt;
    settings.adminPasswordHash = await hashPassword(newPassword, salt);
    saveSettings(settings);
}

// ============================================================
// NHẬT KÝ HOẠT ĐỘNG — ghi lại các thao tác quản trị quan trọng
// (khóa acc nghi hack, xóa, đổi trạng thái, đổi mật khẩu...)
// ============================================================
const MAX_LOG_ENTRIES = 200;

function getActivityLog() {
    const raw = localStorage.getItem(STORAGE_KEYS.activityLog);
    return raw ? JSON.parse(raw) : [];
}

function addActivityLog(action, detail) {
    const logs = getActivityLog();
    logs.unshift({ time: Date.now(), action, detail });
    if (logs.length > MAX_LOG_ENTRIES) logs.length = MAX_LOG_ENTRIES;
    localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(logs));
    return logs;
}

function clearActivityLog() {
    localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify([]));
}
