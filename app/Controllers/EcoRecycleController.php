<?php
require_once 'BaseController.php';

class EcoRecycleController extends BaseController {
    private $wastePickupModel;

    public function __construct($db) {
        require_once 'app/Models/WastePickup.php';
        $this->wastePickupModel = new WastePickup($db);
    }

    public function requestPickup() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        // Memastikan user terautentikasi
        $user = $this->getAuthorizedUser();

        $data = $this->getRequestData();
        $required = ['item_description', 'pickup_address', 'contact_phone', 'weight_kg', 'category'];
        
        foreach ($required as $field) {
            if (!isset($data[$field]) || trim($data[$field]) === '') {
                $this->sendResponse('error', "Field '$field' wajib diisi.", null, 400);
            }
        }

        // Set user_id dari token autentikasi agar aman
        $data['user_id'] = $user['id'];

        $result = $this->wastePickupModel->create($data);
        if ($result) {
            $this->sendResponse('success', 'Permohonan penjemputan e-waste berhasil dibuat.', $result, 201);
        } else {
            $this->sendResponse('error', 'Gagal membuat permohonan penjemputan.', null, 500);
        }
    }

    public function pickupStatus() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            // Memastikan user terautentikasi
            $this->getAuthorizedUser();

            $data = $this->getRequestData();
            if (!isset($data['tracking_number']) || !isset($data['status'])) {
                $this->sendResponse('error', 'Nomor tracking dan status baru wajib diisi.', null, 400);
            }
            
            $location = isset($data['location']) ? $data['location'] : 'System';
            $notes = isset($data['notes']) ? $data['notes'] : 'Status diperbarui';

            // Ubah status
            if ($this->wastePickupModel->updateStatus($data['tracking_number'], $data['status'], $location, $notes)) {
                $this->sendResponse('success', 'Status penjemputan berhasil diperbarui.', [
                    'tracking_number' => $data['tracking_number'], 
                    'new_status' => $data['status']
                ]);
            } else {
                $this->sendResponse('error', 'Nomor tracking tidak ditemukan atau gagal diperbarui.', null, 400);
            }
        } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            // Cek jika meminta statistik global
            $type = isset($_GET['type']) ? $_GET['type'] : '';
            if ($type === 'stats') {
                $stats = $this->wastePickupModel->getStats();
                $this->sendResponse('success', 'Statistik e-waste berhasil diambil.', $stats);
            }

            if (!isset($_GET['tracking_number'])) {
                $this->sendResponse('error', 'Nomor tracking wajib diisi.', null, 400);
            }

            $data = $this->wastePickupModel->findByTrackingNumber($_GET['tracking_number']);
            if ($data) {
                $this->sendResponse('success', 'Data pelacakan ditemukan.', $data);
            } else {
                $this->sendResponse('error', 'Nomor tracking tidak ditemukan.', null, 404);
            }
        } else {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }
    }

    public function assignCollector() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        // Memastikan yang mengoperasikan adalah kolektor terautentikasi
        $user = $this->getAuthorizedUser();
        if ($user['role'] !== 'collector' && $user['role'] !== 'admin') {
            $this->sendResponse('error', 'Akses ditolak. Hanya Kolektor/Admin yang dapat mengambil tugas.', null, 403);
        }

        $data = $this->getRequestData();
        if (!isset($data['tracking_number'])) {
            $this->sendResponse('error', 'Nomor tracking wajib diisi.', null, 400);
        }

        // Collector ID bisa diambil dari body (untuk Admin) atau otomatis dari token (untuk Kolektor)
        $collector_id = ($user['role'] === 'admin' && isset($data['collector_id'])) ? (int)$data['collector_id'] : $user['id'];
        $collector_name = $user['name'];

        if ($this->wastePickupModel->assignCollector($data['tracking_number'], $collector_id, 'Kolektor Wilayah', "Penjemputan diambil alih oleh Kolektor: $collector_name")) {
            $this->sendResponse('success', 'Tugas penjemputan berhasil diambil.', [
                'tracking_number' => $data['tracking_number'],
                'collector_id' => $collector_id
            ]);
        } else {
            $this->sendResponse('error', 'Gagal menetapkan tugas penjemputan.', null, 400);
        }
    }

    public function estimateReward() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        $data = $this->getRequestData();
        if (!isset($data['category']) || !isset($data['weight_kg'])) {
            $this->sendResponse('error', 'Kategori dan berat (KG) wajib diisi.', null, 400);
        }

        $weight = (float)$data['weight_kg'];
        if ($weight <= 0) {
            $this->sendResponse('error', 'Berat harus lebih besar dari 0 KG.', null, 400);
        }

        $category = $data['category'];
        
        // Mock kalkulasi rate berdasarkan kategori
        $reward_rate = 5000;
        if (strpos(strtolower($category), 'computer') !== false || strpos(strtolower($category), 'laptop') !== false) {
            $reward_rate = 7000;
        } else if (strpos(strtolower($category), 'large') !== false || strpos(strtolower($category), 'kulkas') !== false || strpos(strtolower($category), 'ac') !== false) {
            $reward_rate = 10000;
        } else if (strpos(strtolower($category), 'batter') !== false || strpos(strtolower($category), 'ups') !== false) {
            $reward_rate = 3000;
        }

        $total_reward = $reward_rate * $weight;
        $co2_saved = $weight * 2.5; // Estimasi 1 KG e-waste = 2.5 KG CO2 offset

        $this->sendResponse('success', 'Estimasi reward berhasil dihitung.', [
            'category' => $category,
            'weight_kg' => $weight,
            'reward_rate' => $reward_rate,
            'total_estimate' => $total_reward,
            'co2_saved' => $co2_saved
        ]);
    }

    public function processPayout() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        // Memastikan yang memproses adalah Admin/Finance
        $user = $this->getAuthorizedUser();
        if ($user['role'] !== 'admin') {
            $this->sendResponse('error', 'Akses ditolak. Hanya Admin/Finance yang dapat menyetujui payout.', null, 403);
        }

        $data = $this->getRequestData();
        if (!isset($data['pickup_id'])) {
            $this->sendResponse('error', 'pickup_id wajib diisi.', null, 400);
        }

        $pickup = $this->wastePickupModel->findById($data['pickup_id']);
        if ($pickup) {
            if ($pickup['is_processed']) {
                $this->sendResponse('error', 'Eco-reward untuk penjemputan ini sudah pernah diproses.', null, 400);
            }

            $payout_amount = $pickup['eco_reward'];
            $transaction_ref = 'TX-' . time() . '-' . rand(1000, 9999);

            if ($this->wastePickupModel->updateProcessingStatus($pickup['id'], $transaction_ref, $payout_amount)) {
                $this->sendResponse('success', 'Eco-reward payout berhasil diproses.', [
                    'pickup_id' => $pickup['id'],
                    'amount_paid' => $payout_amount,
                    'transaction_reference' => $transaction_ref
                ]);
            } else {
                $this->sendResponse('error', 'Gagal memproses payout di database.', null, 500);
            }
        } else {
            $this->sendResponse('error', 'Data penjemputan tidak ditemukan.', null, 404);
        }
    }

    public function listPickups() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        // Memastikan user terautentikasi
        $user = $this->getAuthorizedUser();

        $type = isset($_GET['type']) ? $_GET['type'] : 'all';
        $data = [];

        if ($type === 'user') {
            // Eco Warrior melihat riwayatnya sendiri
            $user_id = $user['id'];
            $data = $this->wastePickupModel->findAllByUser($user_id);
        } else if ($type === 'collector') {
            // Eco Collector melihat tugasnya (atau semua tugas jika kolektor ingin meng-claim)
            $collector_id = $user['id'];
            $data = $this->wastePickupModel->findAllByCollector($collector_id);
        } else {
            // Admin melihat seluruh penjemputan
            if ($user['role'] !== 'admin') {
                $this->sendResponse('error', 'Akses ditolak. Perlu hak akses Administrator.', null, 403);
            }
            $data = $this->wastePickupModel->findAll();
        }

        $this->sendResponse('success', 'Daftar penjemputan e-waste berhasil diambil.', $data);
    }
}
?>
