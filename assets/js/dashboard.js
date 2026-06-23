// EcoRecycle Eco Warrior Dashboard Logic

let monthlyChart = null;

const categoryConfig = {
    'Small Gadgets': { rate: 5000, feePerKg: 500 },
    'Computers': { rate: 7000, feePerKg: 1000 },
    'Large Appliances': { rate: 10000, feePerKg: 5000 },
    'Batteries': { rate: 3000, feePerKg: 2000 }
};

// Tab Switching
const tabs = document.querySelectorAll('.hub-tab');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.getAttribute('data-target');
        panes.forEach(p => p.classList.remove('active'));
        
        const targetPane = document.getElementById(target);
        if (targetPane) {
            targetPane.classList.add('active');
        }

        // Close sidebar on mobile
        closeSidebar();
    });
});

// Mobile Sidebar Toggle
const hamburgerBtn = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
    if (sidebar) sidebar.classList.add('active');
    if (sidebarOverlay) sidebarOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// Payout Preview Calculation
function calculateFormPreview() {
    const categorySelect = document.getElementById('form-waste-category');
    const weightInput = document.getElementById('form-waste-weight');
    
    if (!categorySelect || !weightInput) return;

    const weight = parseFloat(weightInput.value) || 0;
    
    const category = categorySelect.value;
    const config = categoryConfig[category] || categoryConfig['Small Gadgets'];

    const gross = weight * config.rate;
    const fee = weight * config.feePerKg;
    const net = gross - fee;
    const carbon = (weight * 2.5).toFixed(1);

    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    document.getElementById('preview-gross-reward').innerText = formatter.format(gross);
    document.getElementById('preview-fee').innerText = formatter.format(fee);
    document.getElementById('preview-net-reward').innerText = formatter.format(net);
    document.getElementById('preview-carbon').innerText = carbon;
}

const formWeight = document.getElementById('form-waste-weight');
const formCat = document.getElementById('form-waste-category');

if (formWeight) formWeight.addEventListener('input', calculateFormPreview);
if (formCat) formCat.addEventListener('change', calculateFormPreview);

function syncCategoryCards(category) {
    document.querySelectorAll('.category-helper-card').forEach(card => {
        card.classList.toggle('active', card.dataset.category === category);
    });
}

document.querySelectorAll('.category-helper-card').forEach(card => {
    card.addEventListener('click', () => {
        const categorySelect = document.getElementById('form-waste-category');
        const weightInput = document.getElementById('form-waste-weight');
        const descriptionInput = document.getElementById('form-item-description');

        if (categorySelect) categorySelect.value = card.dataset.category;
        if (weightInput) weightInput.value = card.dataset.weight;
        if (descriptionInput && descriptionInput.value.trim() === '') {
            descriptionInput.value = card.dataset.example;
        }

        syncCategoryCards(card.dataset.category);
        calculateFormPreview();
    });
});

if (formCat) {
    formCat.addEventListener('change', () => {
        syncCategoryCards(formCat.value);
        calculateFormPreview();
    });
}

const photoInput = document.getElementById('form-waste-photo');
const photoPreviewCard = document.getElementById('photo-preview-card');
const photoPreviewImg = document.getElementById('photo-preview-img');
const removePhotoBtn = document.getElementById('remove-photo-btn');

function clearPhotoPreview() {
    if (photoInput) photoInput.value = '';
    if (photoPreviewImg) photoPreviewImg.removeAttribute('src');
    if (photoPreviewCard) photoPreviewCard.style.display = 'none';
}

if (photoInput) {
    photoInput.addEventListener('change', () => {
        const file = photoInput.files[0];
        if (!file) {
            clearPhotoPreview();
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            clearPhotoPreview();
            Swal.fire({
                icon: 'warning',
                title: 'Format Foto Tidak Sesuai',
                text: 'Gunakan foto JPG, PNG, atau WEBP.',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            clearPhotoPreview();
            Swal.fire({
                icon: 'warning',
                title: 'Foto Terlalu Besar',
                text: 'Ukuran foto maksimal 5 MB.',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        if (photoPreviewImg && photoPreviewCard) {
            photoPreviewImg.src = URL.createObjectURL(file);
            photoPreviewCard.style.display = 'block';
        }
    });
}

if (removePhotoBtn) removePhotoBtn.addEventListener('click', clearPhotoPreview);

// Logout
function logoutUser() {
    localStorage.removeItem('user');
    window.location.href = 'login';
}

// System Notification Alert Close
function closeNotification() {
    document.getElementById('system-notification-box').style.display = 'none';
}

function openTrackingDetail(trackingNumber) {
    const trackInput = document.getElementById('track-number-search');
    if (trackInput) trackInput.value = trackingNumber;
    const trackingTab = document.querySelector('.sidebar-item[data-target="lacak-pickup"]');
    if (trackingTab) trackingTab.click();
    searchTracking();
}

// 4. Load User Data & Pickups
function loadDashboardData() {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
        window.location.href = 'login';
        return;
    }

    const user = JSON.parse(userSession);
    
    // Set Profile Info
    document.getElementById('hero-welcome').innerText = `Halo, ${user.name}!`;
    document.getElementById('user-display-name').innerText = user.name;
    document.getElementById('profile-avatar').innerText = user.name.substring(0, 2).toUpperCase();
    
    const settingsName = document.getElementById('settings-name');
    const settingsEmail = document.getElementById('settings-email');
    if (settingsName) settingsName.value = user.name;
    if (settingsEmail) settingsEmail.value = user.email;

    const donorNameInput = document.getElementById('form-donor-name');
    if (donorNameInput) donorNameInput.value = user.name;

    // Fetch Pickups from API
    fetch('api/ecorecycle/list_pickups?type=user', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + user.token
        }
    })
    .then(res => {
        if (res.status === 401) {
            logoutUser();
        }
        return res.json();
    })
    .then(data => {
        if (data.status === 'success') {
            const pickups = data.data;
            
            // Calculate Metrics
            let totalWeight = 0;
            let totalCarbon = 0;
            let totalReward = 0;
            let activeHtml = '';
            let historyHtml = '';
            
            // Chart Data Helpers
            const monthlyWeights = {};

            pickups.forEach(item => {
                const weight = parseFloat(item.weight_kg);
                const carbon = weight * 2.5;
                const netReward = parseFloat(item.eco_reward) - parseFloat(item.processing_fee);
                
                totalWeight += weight;
                totalCarbon += carbon;

                if (item.status === 'completed') {
                    totalReward += netReward;
                }

                // Group weights by month for Chart.js
                const dateObj = new Date(item.created_at);
                const monthName = dateObj.toLocaleString('id-ID', { month: 'short' });
                monthlyWeights[monthName] = (monthlyWeights[monthName] || 0) + weight;

                // Format Date
                const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('id-ID', { month: 'short' })} ${dateObj.getFullYear()}`;
                
                // Add to history list
                let badgeClass = 'pending';
                if (item.status === 'pickup') badgeClass = 'pickup';
                else if (item.status === 'transit') badgeClass = 'transit';
                else if (item.status === 'arrived') badgeClass = 'arrived';
                else if (item.status === 'completed') badgeClass = 'completed';

                historyHtml += `
                    <tr>
                        <td style="padding: 16px;">${dateStr}</td>
                        <td style="padding: 16px;"><strong>${item.tracking_number}</strong></td>
                        <td style="padding: 16px;">${item.category_name}</td>
                        <td style="padding: 16px; font-weight:700;">${weight} KG</td>
                        <td style="padding: 16px; font-weight:800; color:#059669;">Rp ${netReward.toLocaleString('id-ID')}</td>
                        <td style="padding: 16px;"><span class="status-badge ${badgeClass}">${item.status.toUpperCase()}</span></td>
                    </tr>
                `;

                // Add to active pickups list if not completed
                if (item.status !== 'completed') {
                    let stepIcon = 'fa-clock';
                    let stepText = 'Menunggu kolektor mengambil e-waste.';
                    
                    if (item.status === 'pickup') {
                        stepIcon = 'fa-truck-fast';
                        stepText = 'Kolektor bersiap menjemput e-waste Anda.';
                    } else if (item.status === 'transit') {
                        stepIcon = 'fa-warehouse';
                        stepText = 'E-waste dalam perjalanan menuju Recycling Hub.';
                    } else if (item.status === 'arrived') {
                        stepIcon = 'fa-clipboard-check';
                        stepText = 'E-waste sudah tiba di hub dan menunggu payout admin.';
                    }

                    activeHtml += `
                        <div class="active-pickup-card" style="display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap;">
                            <div>
                                <span style="font-size:0.75rem; font-weight:800; color:var(--text-secondary); text-transform:uppercase;">No. Tracking</span>
                                <h4 style="font-weight:900; color:var(--brand-dark); margin:2px 0;">${item.tracking_number}</h4>
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin:4px 0 0 0;">${item.category_name} • ${weight} KG</p>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <div style="background:#ecfdf5; color:#10b981; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas ${stepIcon}"></i></div>
                                <div>
                                    <span class="status-badge ${badgeClass}">${item.status.toUpperCase()}</span>
                                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:2px 0 0 0;">${stepText}</p>
                                </div>
                                <button type="button" class="btn btn-outline" style="height:38px; padding:0 14px; border-radius:10px; font-weight:800;" onclick="openTrackingDetail('${item.tracking_number}')">Lacak</button>
                            </div>
                        </div>
                    `;
                }
            });

            // Update Level Badge
            let userLevel = "Bronze Saver";
            if (totalWeight >= 15) userLevel = "Emerald Hero";
            else if (totalWeight >= 5) userLevel = "Silver Guardian";
            
            document.getElementById('user-display-level').innerText = userLevel;
            document.getElementById('profile-avatar').style.background = totalWeight >= 15 ? '#10b981' : totalWeight >= 5 ? '#0d9488' : '#64748b';

            // Set Metrics
            const rupiahFormatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
            document.getElementById('metric-total-weight').innerText = totalWeight.toFixed(1);
            document.getElementById('metric-total-carbon').innerText = totalCarbon.toFixed(1);
            document.getElementById('metric-total-reward').innerText = rupiahFormatter.format(totalReward);

            // Set Table Data
            const historyBody = document.getElementById('payout-history-table-body');
            if (historyBody) {
                if (historyHtml === '') {
                    historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color:var(--text-secondary);">Belum ada riwayat donasi e-waste.</td></tr>';
                } else {
                    historyBody.innerHTML = historyHtml;
                }
            }

            // Set Active Pickups
            const activeContainer = document.getElementById('active-pickups-container');
            if (activeContainer) {
                if (activeHtml === '') {
                    activeContainer.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-secondary);">Tidak ada penjemputan e-waste aktif saat ini.</div>';
                } else {
                    activeContainer.innerHTML = activeHtml;
                    
                    // Show notification banner if there is an active pickup
                    const latestPickup = pickups[0];
                    if (latestPickup && latestPickup.status !== 'completed') {
                        const notifBox = document.getElementById('system-notification-box');
                        const notifMsg = document.getElementById('notification-message');
                        if (notifBox && notifMsg) {
                            notifMsg.innerHTML = `Penjemputan <strong>${latestPickup.tracking_number}</strong> dalam status: <strong>${latestPickup.status.toUpperCase()}</strong>.`;
                            notifBox.style.display = 'flex';
                        }
                    }
                }
            }

            // Render Chart
            renderChart(monthlyWeights);
        }
    })
    .catch(err => {
        console.error('Error fetching dashboard data:', err);
    });
}

// 5. Submit New Pickup Form
const pickupForm = document.getElementById('pickup-request-form');
if (pickupForm) {
    pickupForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const userSession = localStorage.getItem('user');
        if (!userSession) return;
        const user = JSON.parse(userSession);

        const btn = this.querySelector('button[type="submit"]');
        const originalHtml = btn.innerHTML;

        const phone = document.getElementById('form-donor-phone').value.trim();
        const address = document.getElementById('form-pickup-address').value.trim();
        const description = document.getElementById('form-item-description').value.trim();
        const weight = parseFloat(document.getElementById('form-waste-weight').value);

        if (!/^(\+62|62|0)8[0-9]{8,13}$/.test(phone.replace(/\s|-/g, ''))) {
            Swal.fire({
                icon: 'warning',
                title: 'Nomor Kontak Belum Valid',
                text: 'Masukkan nomor WhatsApp Indonesia yang aktif.',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        if (address.length < 15 || description.length < 10 || !weight || weight <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Data Belum Lengkap',
                text: 'Pastikan alamat, deskripsi barang, dan berat sudah diisi dengan benar.',
                confirmButtonColor: '#10b981'
            });
            return;
        }

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('item_description', description);
        formData.append('pickup_address', address);
        formData.append('contact_phone', phone);
        formData.append('weight_kg', weight);
        formData.append('category', document.getElementById('form-waste-category').value);

        const photoInput = document.getElementById('form-waste-photo');
        if (photoInput && photoInput.files.length > 0) {
            formData.append('photo', photoInput.files[0]);
        }

        fetch('api/ecorecycle/request_pickup', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + user.token
            },
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Permohonan Berhasil!',
                    html: `Nomor Tracking: <strong>${data.data.tracking_number}</strong><br>Kolektor kami akan segera menghubungi Anda.`,
                    confirmButtonColor: '#10b981',
                    confirmButtonText: 'Lacak Status'
                }).then(() => {
                    pickupForm.reset();
                    clearPhotoPreview();
                    syncCategoryCards('Small Gadgets');
                    calculateFormPreview();
                    loadDashboardData();
                    const trackInput = document.getElementById('track-number-search');
                    if (trackInput) trackInput.value = data.data.tracking_number;
                    document.querySelector('.sidebar-item[data-target="lacak-pickup"]').click();
                    searchTracking();
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: data.message,
                    confirmButtonColor: '#10b981'
                });
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        })
        .catch(err => {
            Swal.fire({
                icon: 'error',
                title: 'Kesalahan',
                text: 'Gagal menghubungi server.',
                confirmButtonColor: '#10b981'
            });
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        });
    });
}

// 6. Track Search
function searchTracking() {
    const input = document.getElementById('track-number-search');
    const container = document.getElementById('tracking-timeline-container');
    
    if (!input || !container) return;
    const trackingNum = input.value.trim();

    if (trackingNum === '') {
        Swal.fire({
            icon: 'warning',
            title: 'Kolom Kosong',
            text: 'Silakan masukkan nomor tracking terlebih dahulu.',
            confirmButtonColor: '#10b981'
        });
        return;
    }

    const userSession = localStorage.getItem('user');
    if (!userSession) return;
    const user = JSON.parse(userSession);

    fetch(`api/ecorecycle/pickup_status?tracking_number=${trackingNum}`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + user.token
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            const item = data.data;
            const history = item.history || [];

            document.getElementById('track-disp-number').innerText = item.tracking_number;
            
            let badgeClass = 'pending';
            if (item.status === 'pickup') badgeClass = 'pickup';
            else if (item.status === 'transit') badgeClass = 'transit';
            else if (item.status === 'arrived') badgeClass = 'arrived';
            else if (item.status === 'completed') badgeClass = 'completed';

            const statusBadge = document.getElementById('track-disp-status');
            statusBadge.className = `status-badge ${badgeClass}`;
            statusBadge.innerText = item.status.toUpperCase();

            document.getElementById('track-disp-detail').innerText = `${item.category_name} • ${item.weight_kg} KG`;

            // Populate Timeline
            const timelineList = document.getElementById('track-timeline-list');
            timelineList.innerHTML = '';

            if (history.length === 0) {
                timelineList.innerHTML = '<p style="color:var(--text-secondary);">Belum ada log pelacakan.</p>';
            } else {
                history.forEach(log => {
                    const dateObj = new Date(log.updated_at);
                    const timeStr = `${dateObj.getDate()} ${dateObj.toLocaleString('id-ID', { month: 'short' })} ${dateObj.getFullYear()}, ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    
                    timelineList.innerHTML += `
                        <div class="timeline-node">
                            <div class="timeline-node-dot"></div>
                            <div class="timeline-node-time">${timeStr}</div>
                            <div class="timeline-node-title">${log.status.toUpperCase()}</div>
                            <div class="timeline-node-desc">Lokasi: <strong>${log.location}</strong><br>${log.notes}</div>
                        </div>
                    `;
                });
            }

            container.style.display = 'block';
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Tidak Ditemukan',
                text: 'Nomor tracking tidak terdaftar.',
                confirmButtonColor: '#10b981'
            });
        }
    })
    .catch(err => {
        Swal.fire({
            icon: 'error',
            title: 'Kesalahan',
            text: 'Gagal terhubung ke server.',
            confirmButtonColor: '#10b981'
        });
    });
}

// 7. Update Settings Form
const settingsForm = document.getElementById('settings-profile-form');
if (settingsForm) {
    settingsForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        Swal.fire({
            icon: 'success',
            title: 'Profil Disimpan',
            text: 'Perubahan profil berhasil disimpan.',
            confirmButtonColor: '#10b981'
        });
    });
}

// 8. Render Chart.js
function renderChart(monthlyWeights) {
    const ctx = document.getElementById('monthlyWasteChart');
    if (!ctx) return;

    const labels = Object.keys(monthlyWeights).reverse();
    const weights = Object.values(monthlyWeights).reverse();

    // Fallback if empty
    if (labels.length === 0) {
        labels.push('Mei');
        weights.push(0);
    }

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Berat E-Waste (KG)',
                data: weights,
                backgroundColor: '#10b981',
                borderRadius: 8,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    syncCategoryCards(formCat ? formCat.value : 'Small Gadgets');
    calculateFormPreview();
});
