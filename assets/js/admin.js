// EcoRecycle Admin Command Center Logic

let liveMap;
let financeChart;
let globalPickups = [];
let activeFilterRange = 'all'; // all, today, week, month

function toggleAdminSidebar() {
    document.getElementById('sidebar').classList.add('active');
    document.getElementById('sidebarOverlay').style.display = 'block';
}

function closeAdminSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').style.display = 'none';
}

function switchAdminTab(targetId) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));

    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.add('active');

    const sidebarItem = document.querySelector(`.sidebar-item[data-target="${targetId}"]`);
    if (sidebarItem) sidebarItem.classList.add('active');

    if (targetId === 'admin-view') {
        setTimeout(initLiveMap, 200);
    } else if (targetId === 'finance-view') {
        setTimeout(initFinanceChart, 200);
    }

    closeAdminSidebar();
}

function logoutAdmin() {
    localStorage.removeItem('user');
    window.location.href = 'login';
}

// 1. Initialize Map
function initLiveMap() {
    try {
        const mapEl = document.getElementById('live-map');
        if (!mapEl) return;
        if (liveMap) liveMap.remove();
        if (typeof L === 'undefined') return;

        liveMap = L.map('live-map', { zoomControl: false }).setView([-6.9175, 107.6191], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(liveMap);

        // Add markers for active pickups (pickup/transit/arrived)
        const activePickups = globalPickups.filter(p => p.status === 'pickup' || p.status === 'transit' || p.status === 'arrived');
        
        activePickups.forEach((item, index) => {
            const hash = Array.from(item.tracking_number).reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const latOffset = (((hash * (index + 1)) % 100) - 50) / 10000;
            const lngOffset = (((hash * (index + 2)) % 100) - 50) / 10000;
            
            const markerColor = item.status === 'arrived' ? '#15803d' : item.status === 'transit' ? '#0d9488' : '#1d4ed8';
            
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background:${markerColor}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px rgba(0,0,0,0.2);"></div>`
            });

            L.marker([-6.9175 + latOffset, 107.6191 + lngOffset], { icon: customIcon })
                .addTo(liveMap)
                .bindPopup(`<strong>${item.tracking_number}</strong><br>Pengirim (Masyarakat): ${item.donor_name}<br>Status: ${item.status.toUpperCase()}`);
        });

        setTimeout(() => { liveMap.invalidateSize(); }, 400);
    } catch (e) {
        console.error('Failed to initialize admin map:', e);
    }
}

// 2. Load KPIs and Data
function loadAdminCommandData() {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
        window.location.href = 'login';
        return;
    }
    const user = JSON.parse(userSession);

    if (user.role !== 'admin') {
        window.location.href = 'login';
        return;
    }

    // Set Header profile
    document.getElementById('welcome-message').innerText = `Selamat Datang, ${user.name}`;
    document.getElementById('admin-display-name').innerText = user.name;
    document.getElementById('admin-avatar').innerText = user.name.substring(0, 2).toUpperCase();

    // Fetch Global Pickups
    fetch('api/ecorecycle/list_pickups?type=all', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + user.token
        }
    })
    .then(res => {
        if (res.status === 401) logoutAdmin();
        return res.json();
    })
    .then(data => {
        if (data.status === 'success') {
            globalPickups = data.data;

            // Update global pickups tables
            renderPickupsTables();

            // Load Stats KPI via separate API
            fetch('api/ecorecycle/pickup_status?type=stats', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + user.token
                }
            })
            .then(r => r.json())
            .then(statRes => {
                if (statRes.status === 'success') {
                    const stats = statRes.data;
                    
                    document.getElementById('kpi-total-weight').innerText = parseFloat(stats.total_weight).toFixed(1);
                    document.getElementById('kpi-total-pickups').innerText = stats.total_pickups;
                    document.getElementById('kpi-pending-pickups').innerText = stats.pending_verifications;
                    document.getElementById('kpi-active-collectors').innerText = stats.collectors_online;

                    // Finance tab KPIs
                    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
                    document.getElementById('finance-paid-amount').innerText = formatter.format(stats.total_reward_paid);
                    document.getElementById('finance-pending-amount').innerText = formatter.format(stats.total_reward_pending);
                }
            });

            initLiveMap();
        }
    })
    .catch(err => {
        console.error('Error loading admin dashboard data:', err);
    });
}

function renderPickupsTables() {
    const pendingBody = document.getElementById('pendingPickupsTableBody');
    const globalBody = document.getElementById('globalPickupsTableBody');
    const payoutBody = document.getElementById('payoutLedgerTableBody');

    if (pendingBody) pendingBody.innerHTML = '';
    if (globalBody) globalBody.innerHTML = '';
    if (payoutBody) payoutBody.innerHTML = '';

    let pendingHtml = '';
    let globalHtml = '';
    let payoutHtml = '';

    const searchVal = document.getElementById('admin-search-input').value.toLowerCase().trim();

    globalPickups.forEach(item => {
        // Filter by search query
        if (searchVal !== '' && !item.tracking_number.toLowerCase().includes(searchVal)) return;

        // Filter by Date Range
        const dateObj = new Date(item.created_at);
        const now = new Date();
        if (activeFilterRange === 'today') {
            if (dateObj.toDateString() !== now.toDateString()) return;
        } else if (activeFilterRange === 'week') {
            const diffTime = Math.abs(now - dateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 7) return;
        } else if (activeFilterRange === 'month') {
            if (dateObj.getMonth() !== now.getMonth() || dateObj.getFullYear() !== now.getFullYear()) return;
        }

        const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
        const netReward = parseFloat(item.eco_reward) - parseFloat(item.processing_fee);

        let badgeClass = 'status-pending';
        if (item.status === 'pickup') badgeClass = 'status-processing';
        else if (item.status === 'transit') badgeClass = 'status-processing';
        else if (item.status === 'arrived') badgeClass = 'status-processing';
        else if (item.status === 'completed') badgeClass = 'status-success';

        let statusText = item.status.toUpperCase();
        if (item.status === 'arrived') statusText = 'TIBA DI HUB';

        // Global DB Row
        globalHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:16px; font-weight:800; color:#0f172a;">${item.tracking_number}</td>
                <td style="padding:16px;">${dateStr}</td>
                <td style="padding:16px; font-weight:600;">${item.donor_name}</td>
                <td style="padding:16px;">${item.category_name}</td>
                <td style="padding:16px; font-weight:700;">${item.weight_kg} KG</td>
                <td style="padding:16px; font-weight:600; color:#475569;">${item.collector_name || 'Belum Ditugaskan'}</td>
                <td style="padding:16px;"><span class="status-pill ${badgeClass}">${statusText}</span></td>
            </tr>
        `;

        // Pending Approval Row (Status 'pending')
        if (item.status === 'pending') {
            pendingHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:800; color:#0f172a;">${item.tracking_number}</td>
                    <td style="padding:12px; font-weight:600;">${item.donor_name}</td>
                    <td style="padding:12px;">${item.category_name} • ${item.weight_kg} KG</td>
                    <td style="padding:12px; text-align:right;">
                        <button class="btn btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:8px;" onclick="approveAndAssign('${item.tracking_number}')">Terima & Tugaskan</button>
                    </td>
                </tr>
            `;
        }

        // Payout Ledger Row (Status 'arrived' or 'completed')
        if (item.status === 'arrived' || item.status === 'completed') {
            let actionBtn = `<span class="status-pill status-success"><i class="fas fa-check-double"></i> SUDAH DIBAYAR</span>`;
            if (item.status === 'arrived') {
                actionBtn = `<button class="btn btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; background:#10b981;" onclick="processPayout(${item.id}, ${netReward})">Cairkan Payout</button>`;
            }

            payoutHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding:12px; font-weight:800; color:#0f172a;">${item.tracking_number}</td>
                    <td style="padding:12px; font-weight:600;">${item.donor_name}</td>
                    <td style="padding:12px; font-weight:800; color:#059669;">Rp ${netReward.toLocaleString('id-ID')}</td>
                    <td style="padding:12px; text-align:right;">${actionBtn}</td>
                </tr>
            `;
        }
    });

    if (pendingBody) {
        if (pendingHtml === '') pendingBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">Tidak ada permohonan pending baru.</td></tr>';
        else pendingBody.innerHTML = pendingHtml;
    }

    if (globalBody) {
        if (globalHtml === '') globalBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748b;">Tidak ada data penjemputan terdaftar.</td></tr>';
        else globalBody.innerHTML = globalHtml;
    }

    if (payoutBody) {
        if (payoutHtml === '') payoutBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">Tidak ada data penyerahan siap payout.</td></tr>';
        else payoutBody.innerHTML = payoutHtml;
    }
}

// Search and Date Filter Handlers
function filterPickupsTable() {
    renderPickupsTables();
}

function setFilterRange(range) {
    activeFilterRange = range;
    
    // Highlight active button style in future if we want
    document.querySelectorAll('.filter-panel button').forEach(btn => {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-outline');
    });

    renderPickupsTables();
}

// 3. Admin Accept & Assign Demo Collector
function approveAndAssign(trackingNum) {
    const userSession = localStorage.getItem('user');
    if (!userSession) return;
    const user = JSON.parse(userSession);

    Swal.fire({
        title: 'Terima Permohonan & Tugaskan',
        text: `Terima penjemputan ${trackingNum} dan tugaskan ke Kolektor EcoRecycle?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Tugaskan!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            // Assign to demo collector (ID: 2)
            fetch('api/ecorecycle/assign_collector', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + user.token
                },
                body: JSON.stringify({
                    tracking_number: trackingNum,
                    collector_id: 2 // Demo Collector
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil!',
                        text: 'Tugas penjemputan berhasil diberikan ke Kolektor.',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        loadAdminCommandData();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: data.message,
                        confirmButtonColor: '#10b981'
                    });
                }
            })
            .catch(err => {
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal menghubungi server.',
                    confirmButtonColor: '#10b981'
                });
            });
        }
    });
}

// 4. Process Payout with Digital Transfer
function processPayout(pickupId, amount) {
    const userSession = localStorage.getItem('user');
    if (!userSession) return;
    const user = JSON.parse(userSession);

    Swal.fire({
        title: 'Verifikasi & Cairkan Reward',
        html: `Apakah data timbangan fisik sudah benar?<br>Sistem akan mentransfer <strong>Rp ${amount.toLocaleString('id-ID')}</strong> ke metode e-wallet / transfer bank masyarakat (user).`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Cairkan Dana!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            // Call API
            fetch('api/ecorecycle/process_payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + user.token
                },
                body: JSON.stringify({
                    pickup_id: pickupId
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    const ref = data.data.transaction_reference || data.data.bank_reference || '';
                    Swal.fire({
                        icon: 'success',
                        title: 'Payout Sukses!',
                        html: `Dana berhasil ditransfer.<br>Ref Referensi: <strong>${ref}</strong>`,
                        confirmButtonColor: '#10b981'
                    }).then(() => {
                        loadAdminCommandData();
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Payout Gagal',
                        text: data.message,
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
    });
}

// 5. Initialize Finance Chart.js
function initFinanceChart() {
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    if (financeChart) {
        financeChart.destroy();
    }

    // Process chart values based on completed payouts in database
    const completedPayments = globalPickups.filter(p => p.status === 'completed');
    
    // Group payments by category
    const categoryTotals = {};
    completedPayments.forEach(p => {
        const net = parseFloat(p.eco_reward) - parseFloat(p.processing_fee);
        categoryTotals[p.category_name] = (categoryTotals[p.category_name] || 0) + net;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Fallback if empty
    if (labels.length === 0) {
        labels.push('Gadgets', 'Computers', 'Appliances');
        data.push(50000, 120000, 75000);
    }

    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#10b981', '#0d9488', '#0f766e', '#047857', '#059669'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'Outfit', weight: 'bold' }
                    }
                }
            }
        }
    });
}

// Global scope bindings
window.switchAdminTab = switchAdminTab;
window.toggleAdminSidebar = toggleAdminSidebar;
window.closeAdminSidebar = closeAdminSidebar;
window.logoutAdmin = logoutAdmin;
window.approveAndAssign = approveAndAssign;
window.processPayout = processPayout;
window.filterPickupsTable = filterPickupsTable;
window.setFilterRange = setFilterRange;

document.addEventListener('DOMContentLoaded', loadAdminCommandData);
