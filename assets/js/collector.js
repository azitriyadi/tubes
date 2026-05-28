// EcoRecycle Collector Portal Logic

let map;
let activeTrackingNum = null;
let globalActiveMission = null;

const upcomingList = document.getElementById('upcoming-task-list');
const historyBody = document.getElementById('history-table-body');

function initMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;
        if (map) { map.remove(); }
        if (typeof L === 'undefined') return;

        // Center on Bandung City
        map = L.map('map', { zoomControl: false }).setView([-6.9175, 107.6191], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        if (globalActiveMission) {
            // Draw route between Collector and Donor
            const collIcon = L.divIcon({ className: 'marker-coll', html: '<div style="background:#10b981; width:14px; height:14px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(16,185,129,0.5);"></div>' });
            const donorIcon = L.divIcon({ className: 'marker-donor', html: '<div style="background:#064e3b; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(6,78,59,0.5);"></div>' });

            const hash = Array.from(globalActiveMission.tracking_number).reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const latOffset1 = ((hash % 80) - 40) / 10000;
            const lngOffset1 = (((hash * 2) % 80) - 40) / 10000;
            const latOffset2 = (((hash * 3) % 80) - 40) / 10000;
            const lngOffset2 = (((hash * 5) % 80) - 40) / 10000;

            const p1 = [-6.9175 + latOffset1, 107.6191 + lngOffset1]; // Mock Collector Location
            const p2 = [-6.9250 + latOffset2, 107.6300 + lngOffset2]; // Mock Donor Location

            L.marker(p1, { icon: collIcon }).addTo(map).bindPopup('Lokasi Anda (Kolektor)');
            L.marker(p2, { icon: donorIcon }).addTo(map).bindPopup(`Donatur: ${globalActiveMission.donor_name}`);

            const polyline = L.polyline([p1, p2], { color: '#10b981', weight: 4, dashArray: '6, 12' }).addTo(map);
            map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        }

        setTimeout(() => { map.invalidateSize(); }, 400);
    } catch (e) {
        console.error("Map initialization failed:", e);
    }
}

function switchView(viewId, element) {
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    if (target) {
        target.classList.add('active');
        if (viewId === 'dashboard') setTimeout(initMap, 100);
    }

    document.querySelectorAll('.sidebar-item, .nav-item').forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.sidebar-item, .nav-item');
        navItems.forEach(item => {
            const text = item.innerText.toLowerCase();
            if (text.includes(viewId.replace('-', ' '))) item.classList.add('active');
            else if (viewId === 'dashboard' && (text.includes('home') || text.includes('beranda'))) item.classList.add('active');
        });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openActiveMission() {
    if (globalActiveMission) {
        viewActiveMission(globalActiveMission);
    } else {
        Swal.fire({
            icon: 'info',
            title: 'Tidak Ada Misi Aktif',
            text: 'Saat ini Anda tidak memiliki misi penjemputan aktif. Silakan ambil tugas dari Antrean.',
            confirmButtonColor: '#10b981'
        });
        switchView('dashboard');
    }
}

function viewActiveMission(item) {
    activeTrackingNum = item.tracking_number;
    
    document.getElementById('mission-resi').innerText = item.tracking_number;
    
    let statusText = 'DIJEMPUT';
    if (item.status === 'transit') statusText = 'MENUJU HUB';
    document.getElementById('mission-status').innerText = statusText;
    document.getElementById('mission-status').style.color = item.status === 'transit' ? '#0d9488' : '#1d4ed8';

    document.getElementById('mission-dest').innerText = item.pickup_address;
    document.getElementById('mission-details').innerHTML = `
        <strong>Kategori:</strong> ${item.category_name}<br>
        <strong>Kondisi/Deskripsi:</strong> ${item.item_description}<br>
        <strong>Estimasi Berat:</strong> ${item.weight_kg} KG<br>
        <strong>Kontak Donatur:</strong> ${item.contact_phone} (${item.donor_name})
    `;

    const btn = document.getElementById('mission-btn');
    if (btn) {
        if (item.status === 'pickup') {
            btn.innerHTML = '<i class="fas fa-truck-fast"></i> Mulai Transit (Bawa Sampah ke Hub)';
            btn.style.background = '#0d9488';
            btn.onclick = () => updateMissionStatus(item.tracking_number, 'transit', 'Di Perjalanan', 'Limbah telah diangkut oleh kolektor menuju Recycling Hub.');
        } else if (item.status === 'transit') {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Selesai Verifikasi & Tiba di Hub';
            btn.style.background = '#10b981';
            btn.onclick = () => updateMissionStatus(item.tracking_number, 'arrived', 'Recycling Hub Bandung', 'Sampah elektronik telah tiba di Recycling Hub dan siap diverifikasi admin untuk payout.');
        }
    }
    switchView('active-mission');
}

function updateMissionStatus(trackingNum, newStatus, location, notes) {
    const userSession = localStorage.getItem('user');
    if (!userSession) return;
    const user = JSON.parse(userSession);

    Swal.fire({
        title: 'Konfirmasi Perubahan Status',
        text: `Ubah status penjemputan ${trackingNum} menjadi ${newStatus.toUpperCase()}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Update!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('api/ecorecycle/pickup_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + user.token
                },
                body: JSON.stringify({
                    tracking_number: trackingNum,
                    status: newStatus,
                    location: location,
                    notes: notes
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil',
                        text: 'Status misi berhasil diperbarui!',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => {
                        loadCollectorData();
                        switchView('dashboard');
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
                    text: 'Gagal terhubung ke server.',
                    confirmButtonColor: '#10b981'
                });
            });
        }
    });
}

function claimPickup(trackingNum) {
    const userSession = localStorage.getItem('user');
    if (!userSession) return;
    const user = JSON.parse(userSession);

    Swal.fire({
        title: 'Ambil Tugas Penjemputan',
        text: `Apakah Anda bersedia menjemput sampah elektronik ${trackingNum}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Jemput!',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('api/ecorecycle/assign_collector', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + user.token
                },
                body: JSON.stringify({
                    tracking_number: trackingNum
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Tugas Diambil!',
                        text: 'Silakan lihat rincian alamat donatur di tab Misi Aktif.',
                        confirmButtonColor: '#10b981'
                    }).then(() => {
                        loadCollectorData();
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

function loadCollectorData() {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
        window.location.href = 'auth';
        return;
    }
    const user = JSON.parse(userSession);

    if (user.role !== 'collector') {
        window.location.href = 'auth';
        return;
    }

    // Set UI Profile Info
    document.getElementById('desktop-greeting').innerText = `Selamat bertugas, Kolektor ${user.name}. Siap menyelamatkan bumi hari ini?`;
    document.getElementById('mobile-name').innerText = user.name;
    document.getElementById('profile-name').innerText = user.name;
    document.getElementById('mobile-avatar').innerText = user.name.substring(0, 2).toUpperCase();
    document.getElementById('profile-avatar-large').innerText = user.name.substring(0, 2).toUpperCase();

    // Fetch Collector Pickups
    fetch('api/ecorecycle/list_pickups?type=collector', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + user.token
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            const list = data.data;

            if (upcomingList) upcomingList.innerHTML = '';
            if (historyBody) historyBody.innerHTML = '';

            let totalWeightCollected = 0.0;
            let totalCommissionEarned = 0.0;
            globalActiveMission = null;
            let openTasksHtml = '';
            let historyHtml = '';

            list.forEach(item => {
                const weight = parseFloat(item.weight_kg);
                const commission = (parseFloat(item.eco_reward) - parseFloat(item.processing_fee)) * 0.1; // 10% commission of net reward

                if (item.status === 'completed') {
                    // Mission completed goes to history
                    totalWeightCollected += weight;
                    totalCommissionEarned += commission;

                    const dateObj = new Date(item.created_at);
                    const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('id-ID', { month: 'short' })} ${dateObj.getFullYear()}`;

                    historyHtml += `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 16px; font-weight: 800; color:#064e3b;">${item.tracking_number}</td>
                            <td style="padding: 16px;">${dateStr}</td>
                            <td style="padding: 16px; font-weight: 800; color: #10b981;">+Rp ${commission.toLocaleString('id-ID')}</td>
                            <td style="padding: 16px;"><span class="status-pill success" style="background:#f0fdf4; color:#15803d; font-weight:800; padding:4px 12px; border-radius:50px; font-size:0.75rem;">VERIFIED</span></td>
                        </tr>
                    `;
                } else {
                    // Active or Open Pickups
                    if (item.collector_id == user.id) {
                        // Assigned to me and not completed (status: 'pickup' or 'transit' or 'arrived')
                        if (item.status === 'pickup' || item.status === 'transit') {
                            globalActiveMission = item; // Store active mission
                        }
                        
                        let badgeColor = '#1d4ed8'; // pickup
                        let badgeBg = '#eff6ff';
                        if (item.status === 'transit') {
                            badgeColor = '#0d9488';
                            badgeBg = '#f0fdfa';
                        } else if (item.status === 'arrived') {
                            badgeColor = '#15803d';
                            badgeBg = '#f0fdf4';
                        }

                        openTasksHtml += `
                            <div class="task-item" onclick="viewActiveMission(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                                <div style="display:flex; align-items:center; gap:14px;">
                                    <div style="background:#ecfdf5; color:#10b981; width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;"><i class="fas fa-truck-pickup"></i></div>
                                    <div>
                                        <div style="font-weight:900; font-size: 0.9rem; color:#064e3b;">${item.tracking_number}</div>
                                        <div style="font-size:0.75rem; color:#64748b;">${item.pickup_address.substring(0,25)}...</div>
                                    </div>
                                </div>
                                <span style="background:${badgeBg}; color:${badgeColor}; font-weight:800; padding:4px 10px; border-radius:50px; font-size:0.7rem;">${item.status.toUpperCase()}</span>
                            </div>
                        `;
                    } else if (item.status === 'pending') {
                        // Open task to claim
                        openTasksHtml += `
                            <div class="task-item" style="cursor:default;" onclick="event.stopPropagation();">
                                <div style="display:flex; align-items:center; gap:14px; flex:1;">
                                    <div style="background:#fffbeb; color:#d97706; width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;"><i class="fas fa-hand-holding-hand"></i></div>
                                    <div style="flex:1;">
                                        <div style="font-weight:900; font-size: 0.9rem; color:#064e3b;">${item.tracking_number}</div>
                                        <div style="font-size:0.75rem; color:#64748b;">${item.pickup_address.substring(0,25)}... (${item.weight_kg} KG)</div>
                                    </div>
                                </div>
                                <button class="btn-primary" style="padding: 8px 16px; font-size: 0.75rem; border-radius: 8px; width:auto; border:none; background:#10b981;" onclick="claimPickup('${item.tracking_number}')">AMBIL</button>
                            </div>
                        `;
                    }
                }
            });

            // Set KPIs
            document.getElementById('stat-packages').innerText = `${totalWeightCollected.toFixed(1)} KG`;
            document.getElementById('stat-profit').innerText = `Rp ${totalCommissionEarned.toLocaleString('id-ID')}`;
            document.getElementById('earnings-total').innerText = `Rp ${totalCommissionEarned.toLocaleString('id-ID')}`;

            // Populate open tasks list
            if (upcomingList) {
                if (openTasksHtml === '') {
                    upcomingList.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Tidak ada antrean pickup tersedia.</div>';
                } else {
                    upcomingList.innerHTML = openTasksHtml;
                }
            }

            // Populate history table
            if (historyBody) {
                if (historyHtml === '') {
                    historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">Belum ada riwayat misi penjemputan selesai.</td></tr>';
                } else {
                    historyBody.innerHTML = historyHtml;
                }
            }

            // Render Map
            initMap();
        }
    })
    .catch(err => {
        console.error('Error loading collector data:', err);
    });
}

function logoutCollector() {
    localStorage.removeItem('user');
    window.location.href = 'auth';
}

// Global Exports
window.switchView = switchView;
window.openActiveMission = openActiveMission;
window.claimPickup = claimPickup;
window.logoutCollector = logoutCollector;

document.addEventListener('DOMContentLoaded', loadCollectorData);
