// ============================================================
// script.js — Logic trang khách hàng (đã tối ưu + mở rộng)
// Yêu cầu: data.js phải được nạp trước file này.
// ============================================================

const CLIENT_STATUS_LABELS = {
    selling: { badge: '<span class="acc-status-badge badge-selling">Đang bán</span>', disabled: false, btnText: 'Mua Ngay' },
    sold: { badge: '<span class="acc-status-badge badge-sold">Đã bán</span>', disabled: true, btnText: 'Không Khả Dụng' },
    banned: { badge: '<span class="acc-status-badge badge-banned">Bị ban</span>', disabled: true, btnText: 'Không Khả Dụng' },
    hacked: { badge: '<span class="acc-status-badge badge-hacked">Tạm Khóa (Nghi Hack)</span>', disabled: true, btnText: 'Đang Tạm Khóa' }
};

// Chạy khi tải trang xong
document.addEventListener("DOMContentLoaded", async () => {
    await loadSettingsToClient();
    await renderAccounts(getAccounts());
    initAudioPlayer();
    checkDeviceDiscountCode();
    bindShopGridEvents();     // event delegation: 1 listener duy nhất thay vì N onclick nội tuyến
    bindSearchDebounce();     // tránh render lại toàn bộ lưới trên mỗi phím gõ
});

// Tải cấu hình cài đặt từ Admin lên Client (logo, avatar, nhạc, social links, giới thiệu)
async function loadSettingsToClient() {
    const settings = getSettings();
    const titleEl = document.getElementById('introAdminTitle');
    const introEl = document.getElementById('displayIntroText');
    const audio = document.getElementById('bgAudio');

    if (titleEl) titleEl.textContent = settings.adminTitle;
    if (introEl) introEl.innerHTML = settings.introText;

    // Logo / avatar có thể là URL thường hoặc ảnh admin tải lên từ máy (idb:...)
    const [logoSrc, avatarSrc, audioSrc] = await Promise.all([
        resolveMediaSrc(settings.logoUrl, DEFAULT_LOGO),
        resolveMediaSrc(settings.avatarUrl, DEFAULT_LOGO),
        resolveMediaSrc(settings.audioUrl, '')
    ]);

    const welcomeLogo = document.getElementById('welcomeLogoImg');
    const navbarLogo = document.getElementById('navbarLogoImg');
    const introAvatar = document.getElementById('introAvatarImg');
    if (welcomeLogo) welcomeLogo.src = logoSrc;
    if (navbarLogo) navbarLogo.src = logoSrc;
    if (introAvatar) introAvatar.src = avatarSrc;
    if (audio && audioSrc) audio.src = audioSrc;

    applySocialLinks(settings.socialLinks || {});
}

// Cập nhật các nút liên kết mạng xã hội theo cấu hình admin
function applySocialLinks(links) {
    const tiktok = document.getElementById('socialTiktok');
    const youtube = document.getElementById('socialYoutube');
    const zalo = document.getElementById('socialZalo');
    const facebook = document.getElementById('socialFacebook');

    if (tiktok && links.tiktok) tiktok.href = links.tiktok;
    if (youtube && links.youtube) youtube.href = links.youtube;
    if (zalo && links.zalo) zalo.href = links.zalo;

    if (facebook) {
        if (links.facebook) {
            facebook.href = links.facebook;
            facebook.target = '_blank';
            facebook.onclick = null;
            facebook.innerHTML = '<i class="fa-brands fa-facebook"></i> Facebook';
        } else {
            facebook.href = '#';
            facebook.removeAttribute('target');
            facebook.onclick = (e) => { e.preventDefault(); alert('Hiện tại face mk không dùng được ae thông cảm nhé😅'); };
            facebook.innerHTML = '<i class="fa-brands fa-facebook"></i> Facebook (Tạm khóa)';
        }
    }
}

// Xử lý màn hình chào mừng (Mở trang & Phát nhạc)
function enterWebsite() {
    const overlay = document.getElementById('welcomeOverlay');
    if (overlay) overlay.classList.add('hidden');

    const audio = document.getElementById('bgAudio');
    if (audio && audio.src) {
        audio.play().catch(e => console.log("Trình duyệt chặn autoplay âm thanh:", e));
    }
}

// Chuyển đổi Tab (SPA Router)
function switchTab(tabId, el) {
    document.querySelectorAll('.page-tab.active').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-link.active').forEach(link => link.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    if (el) el.classList.add('active');
}

// Chuyển đổi Giao diện Sáng / Tối
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const btn = document.getElementById('themeToggleBtn');
    const isLight = document.body.classList.contains('light-theme');
    btn.innerHTML = isLight
        ? '<i class="fa-solid fa-moon"></i> Tối'
        : '<i class="fa-solid fa-sun"></i> Sáng';
}

// Quản lý Trình phát nhạc nền
let isPlayingMusic = false;
function initAudioPlayer() {
    const audio = document.getElementById('bgAudio');
    const progressBar = document.getElementById('audioProgressBar');
    const timeDisplay = document.getElementById('audioTimeDisplay');
    if (!audio) return;

    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const progressPercent = (audio.currentTime / audio.duration) * 100;
        if (progressBar) progressBar.style.width = `${progressPercent}%`;

        if (timeDisplay) {
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        }
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function togglePlayMusic() {
    const audio = document.getElementById('bgAudio');
    const btn = document.getElementById('btnPlayMusic');
    if (!audio || !audio.src) { alert("Chưa có tệp nhạc nào được cấu hình!"); return; }

    if (isPlayingMusic) {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Phát/Tạm dừng nhạc';
        isPlayingMusic = false;
    } else {
        audio.play().then(() => {
            btn.innerHTML = '<i class="fa-solid fa-pause"></i> Đang phát nhạc...';
            isPlayingMusic = true;
        }).catch(() => alert("Không thể phát tệp âm thanh này!"));
    }
}

function seekAudio(event) {
    const audio = document.getElementById('bgAudio');
    const container = document.querySelector('.progress-container');
    if (!audio || !audio.duration || !container) return;

    const rect = container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    audio.currentTime = (clickX / rect.width) * audio.duration;
}

// Xử lý hiển thị mã giảm giá thiết bị
function checkDeviceDiscountCode() {
    const deviceCode = getOrCreateDeviceCode();
    const display = document.getElementById('discountCodeDisplay');
    if (display) display.textContent = `Mã định danh: ${deviceCode} (Giảm 5% đơn đầu tiên)`;
}

function claimDiscountCode() {
    const code = getOrCreateDeviceCode();
    navigator.clipboard.writeText(code);
    alert(`Đã sao chép mã giảm giá: ${code}. Hãy sử dụng khi thanh toán!`);
}

// Vòng quay may mắn
let isSpinning = false;
function spinWheel() {
    if (isSpinning) return;
    isSpinning = true;
    const wheel = document.getElementById('wheelCircle');

    const randomDeg = Math.floor(3600 + Math.random() * 360);
    wheel.style.transform = `rotate(${randomDeg}deg)`;

    setTimeout(() => {
        isSpinning = false;
        alert("Chúc mừng bạn đã quay trúng phần thưởng từ Shop J-Hush! Hãy liên hệ Zalo Admin để nhận thưởng.");
    }, 4000);
}

// Hiển thị danh sách tài khoản (dùng DocumentFragment để giảm số lần reflow)
// Ảnh acc có thể là URL thường hoặc ảnh admin tải lên từ máy (idb:...) nên hàm này là async.
async function renderAccounts(accountsToRender) {
    const grid = document.getElementById('accountGrid');
    if (!grid) return;

    if (accountsToRender.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">Không tìm thấy tài khoản phù hợp.</p>';
        return;
    }

    const fallbackImg = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300';
    const imgSources = await Promise.all(accountsToRender.map(acc => resolveMediaSrc(acc.img, fallbackImg)));

    const fragment = document.createDocumentFragment();

    accountsToRender.forEach((acc, i) => {
        const statusInfo = CLIENT_STATUS_LABELS[acc.status] || CLIENT_STATUS_LABELS.selling;

        const card = document.createElement('div');
        card.className = 'acc-card hover-card';
        // data-* thay cho onclick nội tuyến kèm chuỗi nối tay -> an toàn hơn & nhanh hơn
        card.innerHTML = `
            <div class="acc-img-wrap">
                <img src="${escapeHtml(imgSources[i])}" alt="Ảnh acc ${escapeHtml(acc.code)}" loading="lazy">
                ${statusInfo.badge}
            </div>
            <div class="acc-body">
                <span class="acc-code">${escapeHtml(acc.code)}</span>
                <h4 class="acc-title">${escapeHtml(acc.name)}</h4>
                <div class="acc-price">${formatVND(acc.price)}</div>
                <button class="btn-action-acc" ${statusInfo.disabled ? 'disabled' : ''} data-code="${escapeHtml(acc.code)}" data-price="${acc.price}">
                    ${statusInfo.btnText}
                </button>
            </div>
        `;
        fragment.appendChild(card);
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
}

// Một listener duy nhất trên lưới thay vì gắn onclick cho từng nút (nhanh hơn khi có nhiều acc)
function bindShopGridEvents() {
    const grid = document.getElementById('accountGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-action-acc');
        if (!btn || btn.disabled) return;
        openBuyModal(btn.dataset.code, Number(btn.dataset.price));
    });
}

// Bộ lọc tìm kiếm và mức giá
function filterAccounts() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    const accounts = getAccounts();

    const filtered = accounts.filter(acc =>
        acc.name.toLowerCase().includes(keyword) || acc.code.toLowerCase().includes(keyword)
    );
    renderAccounts(filtered);
}

// Debounce input tìm kiếm: chỉ render lại sau khi người dùng ngừng gõ ~250ms,
// tránh render lại toàn bộ lưới trên từng phím bấm.
function bindSearchDebounce() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(filterAccounts, 250);
    });
}

function setPriceFilter(category, btnElement) {
    document.querySelectorAll('.btn-preset.active').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    const accounts = getAccounts();
    renderAccounts(category === 'all' ? accounts : accounts.filter(acc => acc.category === category));
}

// Modal thanh toán
let currentBuyingCode = '';
let currentBuyingPrice = 0;

function openBuyModal(code, price) {
    currentBuyingCode = code;
    currentBuyingPrice = price;

    const settings = getSettings();
    const bankName = settings.bankName || 'MB';
    const bankAcc = settings.bankAcc || '0362062410';
    const syntax = `Mua ${code}`;

    document.getElementById('modalAccCode').textContent = code;
    document.getElementById('modalAccPrice').textContent = formatVND(price);
    document.getElementById('modalSyntaxCode').textContent = `Nội dung CK: ${syntax}`;

    const qrImg = document.getElementById('modalQrImg');
    qrImg.src = `https://img.vietqr.io/image/${encodeURIComponent(bankName)}-${encodeURIComponent(bankAcc)}-compact2.png?amount=${price}&addInfo=${encodeURIComponent(syntax)}&accountName=${encodeURIComponent(settings.bankOwner || 'VU HUY DUC')}`;

    document.getElementById('buyModal').classList.add('active');
}

function closeModal() {
    document.getElementById('buyModal').classList.remove('active');
}

function confirmPaymentZalo() {
    alert(`Đã ghi nhận yêu cầu mua mã tài khoản [${currentBuyingCode}]. Hệ thống sẽ chuyển hướng bạn sang Zalo Admin để xác thực giao dịch chuyển khoản.`);
    const zaloUrl = (getSettings().socialLinks && getSettings().socialLinks.zalo) || 'https://zalo.me/0362062410';
    const separator = zaloUrl.includes('?') ? '&' : '?';
    const text = encodeURIComponent(`Admin oi, toi da thanh toan don hang ${currentBuyingCode} gia ${currentBuyingPrice}d`);
    window.open(`${zaloUrl}${separator}text=${text}`, '_blank');
    closeModal();
}
