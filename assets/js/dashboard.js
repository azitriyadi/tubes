const tabs = document.querySelectorAll('.hub-tab');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();

        // Update active state on nav links
        tabs.forEach(t => {
            t.classList.remove('active');
        });

        tab.classList.add('active');

        // Switch content panes
        const target = tab.getAttribute('data-target');
        panes.forEach(p => p.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        // Close sidebars if open
        if (typeof closeAllSidebars === 'function') {
            closeAllSidebars();
        }

        // Add minor smooth scroll to top of content if on mobile
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 300, behavior: 'smooth' });
        }
    });
});

// Single Mobile Sidebar Toggle Logic
const hamburgerBtn = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
    if (sidebar) sidebar.classList.add('active');
    if (sidebarOverlay) sidebarOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSidebarAction() {
    if (sidebar) sidebar.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarAction);

// Also close sidebar on link click
tabs.forEach(tab => {
    tab.addEventListener('click', closeSidebarAction);
});

// ================= INTEGRASI API =================
// 1. Cek Tarif
const btnHitung = document.getElementById('btn-hitung-biaya');
if (btnHitung) {
    btnHitung.addEventListener('click', function () {
        const asal = document.getElementById('ongkir-asal').value;
        const tujuan = document.getElementById('ongkir-tujuan').value;
        const berat = document.getElementById('ongkir-weight').value;
        const layanan = document.getElementById('ongkir-service').options[document.getElementById('ongkir-service').selectedIndex].text;

        if (!asal || !tujuan || !berat) {
            Swal.fire({
                icon: 'warning',
                title: 'Data Tidak Lengkap',
                text: 'Mohon lengkapi asal, tujuan, dan berat!'
            });
            return;
        }

        btnHitung.innerText = 'Menghitung...';

        fetch('api/ecorecycle/estimate_reward', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category: layanan, weight_kg: berat })
        })
            .then(res => res.json())
            .then(data => {
                btnHitung.innerText = 'Hitung Biaya';
                if (data.status === 'success') {
                    // Format Rupiah
                    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' });
                    document.getElementById('hasil-ongkir').innerText = "Estimasi Biaya: " + formatter.format(data.data.biaya_ongkir);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: data.message
                    });
                }
            })
            .catch(err => {
                btnHitung.innerText = 'Hitung Biaya';
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal terhubung ke server'
                });
            });
    });
}

// 2. Tracking Resi
const btnTrack = document.getElementById('btn-track-paket');
if (btnTrack) {
    btnTrack.addEventListener('click', function () {
        const resi = document.getElementById('track-input').value;
        if (!resi) {
            Swal.fire({
                icon: 'warning',
                title: 'Resi Kosong',
                text: 'Masukkan nomor resi terlebih dahulu'
            });
            return;
        }

        btnTrack.innerText = 'Mencari...';

        fetch('api/ecorecycle/pickup_status?tracking_number=' + resi, {
            method: 'GET'
        })
            .then(res => res.json())
            .then(data => {
                btnTrack.innerText = 'Cari Paket';
                if (data.status === 'success') {
                    Swal.fire({
                        title: `Status Paket ${data.data.resi}`,
                        html: `<b>Penerima:</b> ${data.data.penerima_nama}<br><b>Status:</b> ${data.data.status.toUpperCase()}`,
                        icon: 'info'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Tidak Ditemukan',
                        text: 'Resi tidak ditemukan!'
                    });
                }
            })
            .catch(err => {
                btnTrack.innerText = 'Cari Paket';
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal terhubung ke server'
                });
            });
    });
}

// 3. Form Kirim Paket Baru (Booking)
const bookingForm = document.getElementById('booking-form');

// Auto Calculate Summary
function calculateSummary() {
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

    const layananSelect = document.getElementById('booking-layanan');
    if(!layananSelect) return;
    
    const basePrice = parseInt(layananSelect.value);
    const berat = parseFloat(document.getElementById('booking-berat').value) || 1;
    const biaya_ongkir = basePrice * Math.ceil(berat);

    const asuransiCheck = document.getElementById('asuransi').checked;
    const nilaiBarang = parseFloat(document.getElementById('booking-nilai-barang').value) || 0;
    let nilai_asuransi = 0;
    if (asuransiCheck && nilaiBarang > 0) {
        nilai_asuransi = nilaiBarang * 0.005;
    }

    const paymentSelect = document.getElementById('booking-pembayaran').value;
    let service_fee = 0;
    if (paymentSelect === 'smartbank') {
        service_fee = biaya_ongkir * 0.05; // 5% fee via SmartBank
    }

    const total = biaya_ongkir + nilai_asuransi + service_fee;

    document.getElementById('summary-ongkir').innerText = formatter.format(biaya_ongkir);
    document.getElementById('summary-asuransi').innerText = formatter.format(nilai_asuransi);
    document.getElementById('summary-fee').innerText = paymentSelect === 'smartbank' ? formatter.format(service_fee) : 'Rp 0';
    document.getElementById('summary-total').innerText = formatter.format(total);

    const btnSubmit = document.getElementById('btn-submit-booking');
    if (paymentSelect === 'smartbank') {
        btnSubmit.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> KONFIRMASI & BAYAR VIA SMARTBANK';
        btnSubmit.style.background = 'var(--brand-primary)';
    } else {
        btnSubmit.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> KONFIRMASI PENGIRIMAN';
        btnSubmit.style.background = 'var(--brand-dark)';
    }
}

if (bookingForm) {
    // Attach event listeners to trigger recalculation
    document.getElementById('booking-layanan').addEventListener('change', calculateSummary);
    document.getElementById('booking-berat').addEventListener('input', calculateSummary);
    document.getElementById('asuransi').addEventListener('change', calculateSummary);
    document.getElementById('booking-nilai-barang').addEventListener('input', calculateSummary);
    document.getElementById('booking-pembayaran').addEventListener('change', calculateSummary);

    // Initial calculation
    calculateSummary();

    bookingForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const btnSubmit = document.getElementById('btn-submit-booking');
        btnSubmit.innerText = 'MEMPROSES...';

        // Ambil data user dari localStorage
        let userId = 3; // Default user_id fallback
        const userSession = localStorage.getItem('user');
        if (userSession) {
            try { userId = JSON.parse(userSession).id; } catch (e) { }
        }

        // Kalkulasi biaya dasar dulu (Simulasi frontend cepat sebelum hitung real backend)
        const layananSelect = document.getElementById('booking-layanan');
        const basePrice = parseInt(layananSelect.value);
        const berat = parseFloat(document.getElementById('booking-berat').value) || 1;
        let biaya_ongkir = basePrice * Math.ceil(berat);

        const asuransiCheck = document.getElementById('asuransi').checked;
        const nilaiBarang = parseFloat(document.getElementById('booking-nilai-barang').value) || 0;
        let nilai_asuransi = 0;
        if (asuransiCheck && nilaiBarang > 0) {
            nilai_asuransi = nilaiBarang * 0.005;
        }
        biaya_ongkir += nilai_asuransi; // Estimasi untuk dikirim

        const payload = {
            user_id: userId,
            pengirim_nama: document.getElementById('booking-pengirim-nama').value,
            pengirim_telp: document.getElementById('booking-pengirim-telp').value,
            pengirim_alamat: document.getElementById('booking-pengirim-alamat').value,
            penerima_nama: document.getElementById('booking-penerima-nama').value,
            penerima_telp: document.getElementById('booking-penerima-telp').value,
            penerima_alamat: document.getElementById('booking-penerima-alamat').value,
            berat: berat,
            layanan: layananSelect.options[layananSelect.selectedIndex].text,
            biaya_ongkir: biaya_ongkir,
            asuransi: asuransiCheck,
            nilai_barang: nilaiBarang
        };

        fetch('api/ecorecycle/request_pickup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                const paymentSelect = document.getElementById('booking-pembayaran').value;
                if (data.status === 'success') {
                    // Jika SmartBank terpilih, otomatis bayar
                    if (paymentSelect === 'smartbank') {
                        fetch('api/ecorecycle/process_payout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pickup_id: data.data.pickup_id })
                        })
                            .then(r => r.json())
                            .then(payData => {
                                if (payData.status === 'success') {
                                    Swal.fire({
                                        icon: 'success',
                                        title: 'Pemesanan Berhasil',
                                        html: `Resi: <b>${data.data.resi}</b><br>Ref: ${payData.data.smartbank_ref}`,
                                        confirmButtonText: 'Mantap!'
                                    }).then(() => {
                                        window.location.reload();
                                    });
                                } else {
                                    Swal.fire({
                                        icon: 'warning',
                                        title: 'Pemesanan Berhasil, Tapi...',
                                        text: 'Pembayaran SmartBank gagal: ' + payData.message,
                                    }).then(() => {
                                        window.location.reload();
                                    });
                                }
                            });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: 'Pemesanan Berhasil',
                            text: `Nomor Resi Anda: ${data.data.resi}`,
                        }).then(() => {
                            window.location.reload();
                        });
                    }
                } else {
                    calculateSummary();
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: data.message
                    });
                }
            })
            .catch(err => {
                calculateSummary();
                Swal.fire({
                    icon: 'error',
                    title: 'Kesalahan',
                    text: 'Gagal terhubung ke server backend'
                });
            });
    });
}

// 4. Initialize User Data & Fetch Pengiriman
function loadUserData() {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
        window.location.href = 'auth';
        return;
    }

    const user = JSON.parse(userSession);
    const navUserName = document.getElementById('nav-user-name');
    if (navUserName) navUserName.innerText = user.name;
    
    const navUserRole = document.getElementById('nav-user-role');
    if (navUserRole) navUserRole.innerText = user.role === 'user' ? 'PREMIUM MEMBER' : user.role.toUpperCase();
    
    const navUserAvatar = document.getElementById('nav-user-avatar');
    if (navUserAvatar) navUserAvatar.innerText = user.name.substring(0, 2).toUpperCase();

    const heroWelcome = document.getElementById('hero-welcome');
    if (heroWelcome) heroWelcome.innerHTML = `Selamat Datang,<br>${user.name}`;

    const pengirimNama = document.getElementById('booking-pengirim-nama');
    if (pengirimNama) pengirimNama.value = user.name;

    // Fetch History
    fetch(`api/ecorecycle/list_pickups?type=user&user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const pengiriman = data.data;
                const historyTable = document.getElementById('history-table-body');
                const activeContainer = document.getElementById('active-status-container');

                if (historyTable) historyTable.innerHTML = '';
                if (activeContainer) activeContainer.innerHTML = '';

                let hasActive = false;

                if (pengiriman.length === 0) {
                    if (historyTable) historyTable.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada riwayat pengiriman</td></tr>';
                    if (activeContainer) activeContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-secondary);">Tidak ada pengiriman aktif</p>';
                    return;
                }

                pengiriman.forEach(item => {
                    // Table row
                    const dateObj = new Date(item.created_at);
                    const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('id-ID', { month: 'short' })} ${dateObj.getFullYear()}`;

                    let badgeClass = 'transit';
                    if (item.status === 'delivered') badgeClass = 'delivered';
                    else if (item.status === 'pending') badgeClass = 'processing';

                    if (historyTable) {
                        historyTable.innerHTML += `
                            <tr>
                                <td>${dateStr}</td>
                                <td><strong>${item.resi}</strong></td>
                                <td>${item.penerima_nama}</td>
                                <td>${item.penerima_alamat.substring(0, 20)}...</td>
                                <td>${item.nama_layanan || item.layanan_id}</td>
                                <td><span class="status-badge ${badgeClass}">${item.status.toUpperCase()}</span></td>
                            </tr>
                        `;
                    }

                    // Active Cards
                    if (item.status !== 'delivered') {
                        hasActive = true;
                        let icon = 'fa-boxes';
                        if (item.status === 'transit') icon = 'fa-truck-fast';

                        if (activeContainer) {
                            activeContainer.innerHTML += `
                                <div style="background-color: var(--gray-50); border-radius: 20px; padding: 32px; margin-bottom: 24px; border: 1px solid var(--gray-100);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                                        <div>
                                            <h4 style="font-size: 1.2rem; font-weight: 800; color: var(--brand-dark);">${item.resi}</h4>
                                            <p style="color: var(--text-secondary); font-size: 0.9rem;">Menuju: ${item.penerima_nama} (${item.penerima_alamat.substring(0,15)}...)</p>
                                        </div>
                                        <span class="status-badge ${badgeClass}">${item.status.toUpperCase()}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 16px;">
                                        <i class="fas ${icon}" style="font-size: 2rem; color: var(--brand-primary);"></i>
                                        <div>
                                            <p style="font-weight: 700;">Paket dalam status: ${item.status.replace('_', ' ')}</p>
                                            <p style="font-size: 0.8rem; color: var(--text-secondary);">Dibuat: ${dateStr}</p>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    }
                });

                if (!hasActive && activeContainer) {
                    activeContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-secondary);">Tidak ada pengiriman aktif</p>';
                }
            }
        })
        .catch(err => {
            console.error('Error fetching delivery data:', err);
        });
}

// Run on load
document.addEventListener('DOMContentLoaded', loadUserData);
