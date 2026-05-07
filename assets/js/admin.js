// State Machine
let currentRole = 'admin';

// Element Grabbers
const btnAdmin = document.getElementById('btnAdminSide');
const btnFinance = document.getElementById('btnFinanceSide');
const menuContent = document.getElementById('sidebar-menu-content');
const roleLabel = document.getElementById('currentRoleLabel');

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const accountOverlay = document.getElementById('accountOverlay');

// Nav Links Data
const adminLinks = `
    <div class="sidebar-item active" data-target="admin-view"><i class="fas fa-chart-line"></i> Dashboard</div>
    <div class="sidebar-item" data-target="shipments-view"><i class="fas fa-box"></i> Pengiriman</div>
    <div class="sidebar-item" data-target="fleet-view"><i class="fas fa-truck"></i> Armada</div>
    <div class="sidebar-item" data-target="couriers-view"><i class="fas fa-id-card"></i> Kurir</div>
    <div class="sidebar-item" data-target="accounts-view"><i class="fas fa-user-shield"></i> Manajemen Akun</div>
    <div class="sidebar-item" data-target="customers-view"><i class="fas fa-users"></i> Pelanggan</div>
    <div class="sidebar-item" data-target="reports-view"><i class="fas fa-file-invoice"></i> Laporan</div>
`;

const financeLinks = `
    <div class="sidebar-item finance-active active" data-target="finance-view"><i class="fas fa-chart-line"></i> Dashboard Keuangan</div>
    <div class="sidebar-item finance-active" data-target="settlement-view"><i class="fas fa-file-invoice-dollar"></i> Settlement</div>
    <div class="sidebar-item finance-active" data-target="api-view"><i class="fas fa-server"></i> API Gateway</div>
`;

// Universal Navigation Function
function navToView(targetId) {
    // Hide all sections
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(s => s.classList.remove('active'));

    // Show target section
    const target = document.getElementById(targetId);
    if (target) {
        setTimeout(() => target.classList.add('active'), 50);
    }

    // Update Sidebar Active State
    const items = document.querySelectorAll('.sidebar-item');
    items.forEach(item => {
        if (item.getAttribute('data-target') === targetId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Special: Init charts when view is shown
    if (targetId === 'finance-view') {
        setTimeout(initFinanceChart, 100);
    }

    if (window.innerWidth <= 1024) closeSidebar();
}

// Switch Role Logic
function switchToAdmin() {
    if (currentRole === 'admin') return;
    currentRole = 'admin';

    if (btnAdmin) btnAdmin.classList.add('active');
    if (btnFinance) btnFinance.classList.remove('active');
    if (roleLabel) roleLabel.innerText = 'System Admin';

    if (menuContent) menuContent.innerHTML = adminLinks;
    navToView('admin-view');
}

function switchToFinance() {
    if (currentRole === 'finance') return;
    currentRole = 'finance';

    if (btnFinance) btnFinance.classList.add('active');
    if (btnAdmin) btnAdmin.classList.remove('active');
    if (roleLabel) roleLabel.innerText = 'Finance Manager';

    if (menuContent) menuContent.innerHTML = financeLinks;
    navToView('finance-view');
}

function toggleSidebar() {
    if (sidebar) sidebar.classList.toggle('active');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
}

function closeSidebar() {
    if (sidebar) sidebar.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

function toggleAccountOverlay(name = '') {
    if (accountOverlay) accountOverlay.classList.toggle('active');
    if (name) {
        const title = document.getElementById('overlayTitle');
        if (title) title.innerText = 'Edit Akun Pengguna';
        const userInp = document.getElementById('userName');
        if (userInp) userInp.value = name;
    } else {
        const title = document.getElementById('overlayTitle');
        if (title) title.innerText = 'Tambah Akun Baru';
        const userInp = document.getElementById('userName');
        if (userInp) userInp.value = '';
    }
}

function saveUser() {
    Swal.fire({
        icon: 'success',
        title: 'Akun Disimpan',
        text: 'Perubahan akun berhasil disimpan ke database satelit.',
        confirmButtonColor: 'var(--brand-primary)'
    });
    toggleAccountOverlay();
}

// Delegation for sidebar items
document.addEventListener('click', (e) => {
    const sidebarItem = e.target.closest('.sidebar-item');
    if (sidebarItem) {
        const target = sidebarItem.getAttribute('data-target');
        if (target) navToView(target);
    }
});

// Batch Approval Logic with Tab Filtering
const selectAll = document.getElementById('selectAllRequests');
const batchBar = document.getElementById('batchBar');
const batchCount = document.getElementById('batchCount');
const statusTabs = document.querySelectorAll('.status-tab');
const tableRows = document.querySelectorAll('#approvalTableBody tr');

function updateBatchBar() {
    // Count checked boxes only for VISIBLE rows
    const checkedCount = Array.from(tableRows).filter(row =>
        row.style.display !== 'none' &&
        row.querySelector('.request-check') &&
        row.querySelector('.request-check').checked
    ).length;

    if (batchBar && batchCount) {
        if (checkedCount > 0) {
            batchBar.style.display = 'flex';
            batchCount.innerText = checkedCount;
        } else {
            batchBar.style.display = 'none';
        }
    }
}

// Tab Switching Logic
statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-filter');

        // Update active tab UI
        statusTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Filter rows
        tableRows.forEach(row => {
            if (filter === 'all' || row.getAttribute('data-status') === filter) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
                const check = row.querySelector('.request-check');
                if (check) check.checked = false; // Uncheck hidden rows
            }
        });

        if (selectAll) selectAll.checked = false;
        updateBatchBar();
    });
});

if (selectAll) {
    selectAll.addEventListener('change', () => {
        tableRows.forEach(row => {
            if (row.style.display !== 'none') {
                const check = row.querySelector('.request-check');
                if (check) check.checked = selectAll.checked;
            }
        });
        updateBatchBar();
    });
}

// Listen for individual check changes
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('request-check')) {
        updateBatchBar();
    }
});

// Leaflet Map Initialization
let map;
function initMap() {
    if (document.getElementById('map') && typeof L !== 'undefined') {
        // Center on Indonesia (Java region)
        if (!map) {
            map = L.map('map').setView([-6.2088, 106.8456], 7);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        }

        // Custom Icon
        const truckIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fas fa-truck"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Clear existing markers if any
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Add active transit markers dynamically
        if (window.activeTransits && window.activeTransits.length > 0) {
            window.activeTransits.forEach((loc, index) => {
                const latOffset = (Math.random() - 0.5) * 2; 
                const lngOffset = (Math.random() - 0.5) * 2; 
                
                const lat = -6.2088 + latOffset;
                const lng = 106.8456 + lngOffset;

                L.marker([lat, lng], { icon: truckIcon })
                    .addTo(map)
                    .bindPopup(`<b>${loc.resi}</b><br>Tujuan: ${loc.penerima_nama}<br>Status: Moving`);
            });
        }
    }
}

let financeChartInstance = null;
function initFinanceChart(grossArray = [0, 0, 0, 0, 0, 0, 0], settlementArray = [0, 0, 0, 0, 0, 0, 0]) {
    const ctx = document.getElementById('financeChart');
    if (ctx && typeof Chart !== 'undefined') {
        if (financeChartInstance) {
            financeChartInstance.destroy();
        }
        financeChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
                datasets: [{
                    label: 'Gross Revenue (Juta Rp)',
                    data: grossArray,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                }, {
                    label: 'Settlement (Juta Rp)',
                    data: settlementArray,
                    borderColor: '#e11d48',
                    backgroundColor: 'rgba(225, 29, 72, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#e11d48'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Outfit', weight: 'bold' },
                            usePointStyle: true,
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { family: 'Outfit' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
}

// Fetch Admin Data
function loadAdminData() {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
        window.location.href = 'auth';
        return;
    }
    const user = JSON.parse(userSession);
    if (user.role !== 'admin') {
        window.location.href = 'auth';
        return;
    }

    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) userNameEl.innerText = user.name;

    fetch('api/logistikita/daftar_pengiriman?type=all')
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const tbody = document.getElementById('approvalTableBody');
                if (tbody) tbody.innerHTML = '';
                const pengiriman = data.data;

                const kpiTotal = document.getElementById('kpi-total');
                if (kpiTotal) kpiTotal.innerText = pengiriman.length;

                let pendingCount = 0;
                let transitCount = 0;
                let deliveredCount = 0;
                let grossRevenue = 0;
                let miniGridHtml = '';
                let fleetHtml = '';
                let shipmentsHtml = '';
                window.activeTransits = []; // For Map

                pengiriman.forEach(item => {
                    grossRevenue += parseFloat(item.biaya_ongkir) + parseFloat(item.biaya_layanan || 0) + parseFloat(item.asuransi || 0);

                    let dateObj = new Date(item.created_at || Date.now());
                    let dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

                    let statusHtml = '';
                    if (item.status === 'pending') {
                        statusHtml = '<span class="status-pill status-pending">Menunggu Verifikasi</span>';
                    } else if (item.status === 'delivered') {
                        statusHtml = '<span class="status-pill status-success">Terkirim</span>';
                    } else {
                        statusHtml = `<span class="status-pill status-processing">${item.status.toUpperCase()}</span>`;
                    }

                    if (item.status === 'pending') pendingCount++;
                    if (item.status === 'transit') {
                        transitCount++;
                        window.activeTransits.push(item);
                        miniGridHtml += `
                                <tr>
                                    <td>${item.resi}</td>
                                    <td>${item.penerima_nama.substring(0, 10)}...</td>
                                    <td><span class="dot-online"></span></td>
                                </tr>
                            `;
                        fleetHtml += `
                                <tr>
                                    <td><span class="text-bold">${item.resi}</span></td>
                                    <td>Kurir LogistiKita</td>
                                    <td>Sistem Pusat</td>
                                    <td>Menuju Tujuan</td>
                                    <td>-</td>
                                    <td><span class="status-pill status-processing">Moving</span></td>
                                </tr>
                            `;
                    }
                    if (item.status === 'delivered') deliveredCount++;

                    shipmentsHtml += `
                            <tr>
                                <td><span class="text-bold">${item.resi}</span></td>
                                <td>Client ${item.user_id}</td>
                                <td>${item.penerima_nama}</td>
                                <td><span class="text-bold">${item.layanan || item.nama_layanan || '-'}</span></td>
                                <td>${statusHtml}</td>
                                <td>${dateStr}</td>
                                <td><button class="btn-ghost">Detail</button></td>
                            </tr>
                        `;

                    let actionHtml = '';
                    if (item.status === 'pending') {
                        actionHtml = `<button class="btn-action-primary" onclick="updateStatus('${item.resi}', 'menunggu_pickup')"><i class="fas fa-check"></i> Terima</button>`;
                    } else {
                        actionHtml = `<button class="btn-action-secondary" disabled>Selesai</button>`;
                    }

                    if (tbody) {
                        tbody.innerHTML += `
                                <tr data-status="${item.status}">
                                    <td class="check-col"><input type="checkbox" class="custom-checkbox request-check"></td>
                                    <td>
                                        <div style="display: flex; flex-direction: column;">
                                            <span class="text-bold"><span class="urgency-dot urgency-standard"></span>${item.resi}</span>
                                            <span class="text-sub">Penerima: ${item.penerima_nama}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="text-bold" style="color: var(--brand-red);">${item.nama_layanan || item.layanan_id}</span>
                                        <span class="text-sub">${item.penerima_alamat.substring(0,20)}...</span>
                                    </td>
                                    <td>${statusHtml}</td>
                                    <td style="text-align: center;">${actionHtml}</td>
                                </tr>
                            `;
                    }
                });

                if (pengiriman.length === 0 && tbody) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Belum ada permohonan pengiriman baru</td></tr>';
                }

                const kpiPending = document.getElementById('kpi-pending');
                if (kpiPending) kpiPending.innerText = pendingCount;
                const kpiArmada = document.getElementById('kpi-armada');
                if (kpiArmada) kpiArmada.innerText = transitCount;
                const kpiDelivered = document.getElementById('kpi-delivered');
                if (kpiDelivered) kpiDelivered.innerText = deliveredCount;

                const tabAll = document.getElementById('tab-count-all');
                if (tabAll) tabAll.innerText = pengiriman.length;
                const tabPending = document.getElementById('tab-count-pending');
                if (tabPending) tabPending.innerText = pendingCount;
                const tabDelivered = document.getElementById('tab-count-delivered');
                if (tabDelivered) tabDelivered.innerText = deliveredCount;

                const fleetActive = document.getElementById('fleet-active');
                if (fleetActive) fleetActive.innerText = transitCount;
                const fleetTransit = document.getElementById('fleet-transit');
                if (fleetTransit) fleetTransit.innerText = transitCount;
                const fleetArriving = document.getElementById('fleet-arriving');
                if (fleetArriving) fleetArriving.innerText = deliveredCount;

                const miniGrid = document.getElementById('mini-grid-body');
                if (miniGrid) {
                    if (miniGridHtml === '') miniGridHtml = '<tr><td colspan="3" style="text-align:center;">Tidak ada armada di jalan</td></tr>';
                    miniGrid.innerHTML = miniGridHtml;
                }

                const fleetBody = document.getElementById('fleet-table-body');
                if (fleetBody) {
                    if (fleetHtml === '') fleetHtml = '<tr><td colspan="6" style="text-align:center;">Tidak ada armada di jalan</td></tr>';
                    fleetBody.innerHTML = fleetHtml;
                }

                const shipmentsBody = document.getElementById('shipments-table-body');
                if (shipmentsBody) {
                    if (shipmentsHtml === '') shipmentsHtml = '<tr><td colspan="7" style="text-align:center;">Belum ada data pengiriman global</td></tr>';
                    shipmentsBody.innerHTML = shipmentsHtml;
                }

                const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' });
                const grossEl = document.getElementById('finance-gross');
                if (grossEl) grossEl.innerText = formatter.format(grossRevenue);
                const settleEl = document.getElementById('finance-settlement');
                if (settleEl) settleEl.innerText = formatter.format(grossRevenue * 0.1); 
                const marginEl = document.getElementById('finance-margin');
                if (marginEl) marginEl.innerText = '95.5%';

                // Update Map
                initMap();

                // Update Chart Data
                let valInJuta = grossRevenue / 1000000;
                if (valInJuta === 0) valInJuta = 10;
                let gData = [valInJuta * 0.15, valInJuta * 0.20, valInJuta * 0.10, valInJuta * 0.25, valInJuta * 0.10, valInJuta * 0.15, valInJuta * 0.05];
                let sData = gData.map(v => v * 0.7);
                initFinanceChart(gData, sData);
            }
        });

    fetch('api/logistikita/biaya_layanan_logistik')
        .then(r => r.json())
        .then(d => {
            if (d.status === 'success') {
                const totalFeeStr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(d.data.total_fee);
                const el = document.getElementById('finance-total-fee');
                if (el) el.innerText = totalFeeStr;
            }
        });
}



function updateStatus(resi, newStatus) {
    Swal.fire({
        title: 'Konfirmasi',
        text: `Terima pesanan ${resi}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--brand-primary)',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Terima!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('api/logistikita/tracking_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resi: resi, status: newStatus, lokasi: 'Admin HQ', keterangan: 'Pesanan diverifikasi' })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Berhasil',
                            text: 'Status berhasil diupdate!',
                            timer: 1500,
                            showConfirmButton: false
                        });
                        loadAdminData();
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Gagal',
                            text: 'Gagal update status: ' + data.message
                        });
                    }
                })
                .catch(err => {
                    Swal.fire({
                        icon: 'error',
                        title: 'Kesalahan',
                        text: 'Gagal terhubung ke server.'
                    });
                });
        }
    });
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initFinanceChart();
    loadAdminData();

    if (btnAdmin) btnAdmin.addEventListener('click', switchToAdmin);
    if (btnFinance) btnFinance.addEventListener('click', switchToFinance);
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
});
