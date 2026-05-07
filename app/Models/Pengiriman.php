<?php
class Pengiriman {
    private $conn;
    private $table_name = "pengiriman";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        $resi = 'LKT-' . date('Ymd') . '-' . rand(10000, 99999);
        $user_id = (int)$data['user_id'];
        $pengirim_nama = $this->conn->real_escape_string($data['pengirim_nama'] ?? '');
        $pengirim_telp = $this->conn->real_escape_string($data['pengirim_telp'] ?? '');
        $pengirim_alamat = $this->conn->real_escape_string($data['pengirim_alamat'] ?? '');
        $penerima_nama = $this->conn->real_escape_string($data['penerima_nama']);
        $penerima_telp = $this->conn->real_escape_string($data['penerima_telp']);
        $penerima_alamat = $this->conn->real_escape_string($data['penerima_alamat']);
        $berat = (float)$data['berat'];
        
        // Asumsi input layanan sekarang string nama, kita ambil ID nya
        $layanan_str = $this->conn->real_escape_string($data['layanan']);
        $layanan_id = 1; // default
        $res = $this->conn->query("SELECT id FROM layanan WHERE nama_layanan LIKE '%$layanan_str%'");
        if($res && $res->num_rows > 0) {
            $layanan_id = $res->fetch_assoc()['id'];
        }

        $asuransi = isset($data['asuransi']) ? (float)$data['asuransi'] : 0;
        $biaya_ongkir = (float)$data['biaya_ongkir'];
        $biaya_layanan = $biaya_ongkir * 0.05;

        $sql = "INSERT INTO " . $this->table_name . " 
                (user_id, resi, pengirim_nama, pengirim_telp, pengirim_alamat, penerima_nama, penerima_telp, penerima_alamat, berat, layanan_id, asuransi, biaya_ongkir, biaya_layanan, status) 
                VALUES ($user_id, '$resi', '$pengirim_nama', '$pengirim_telp', '$pengirim_alamat', '$penerima_nama', '$penerima_telp', '$penerima_alamat', $berat, $layanan_id, $asuransi, $biaya_ongkir, $biaya_layanan, 'pending')";

        if ($this->conn->query($sql) === TRUE) {
            $pengiriman_id = $this->conn->insert_id;
            // Record in riwayat_status
            $this->addRiwayat($pengiriman_id, 'pending', 'Sistem', 'Pesanan dibuat');

            return [
                'pengiriman_id' => $pengiriman_id,
                'resi' => $resi,
                'biaya_ongkir' => $biaya_ongkir,
                'biaya_layanan' => $biaya_layanan,
                'total_bayar' => $biaya_ongkir + $biaya_layanan + $asuransi,
                'status' => 'pending'
            ];
        }
        return false;
    }

    public function addRiwayat($pengiriman_id, $status, $lokasi, $keterangan) {
        $status = $this->conn->real_escape_string($status);
        $lokasi = $this->conn->real_escape_string($lokasi);
        $keterangan = $this->conn->real_escape_string($keterangan);
        $sql = "INSERT INTO riwayat_status (pengiriman_id, status, lokasi, keterangan) VALUES ($pengiriman_id, '$status', '$lokasi', '$keterangan')";
        $this->conn->query($sql);
    }

    public function updateStatus($resi, $status, $lokasi = '', $keterangan = '') {
        $resi = $this->conn->real_escape_string($resi);
        $status = $this->conn->real_escape_string($status);
        
        $sql = "UPDATE " . $this->table_name . " SET status = '$status' WHERE resi = '$resi'";
        if ($this->conn->query($sql) === TRUE && $this->conn->affected_rows > 0) {
            // Dapatkan ID
            $res = $this->conn->query("SELECT id FROM " . $this->table_name . " WHERE resi = '$resi'");
            if($res->num_rows > 0) {
                $id = $res->fetch_assoc()['id'];
                $this->addRiwayat($id, $status, $lokasi, $keterangan);
            }
            return true;
        }
        return false;
    }

    public function findByResi($resi) {
        $resi = $this->conn->real_escape_string($resi);
        $sql = "SELECT p.*, l.nama_layanan FROM " . $this->table_name . " p 
                LEFT JOIN layanan l ON p.layanan_id = l.id 
                WHERE p.resi = '$resi'";
        $result = $this->conn->query($sql);
        if ($result->num_rows > 0) {
            $data = $result->fetch_assoc();
            
            // Get riwayat
            $riwayat_sql = "SELECT * FROM riwayat_status WHERE pengiriman_id = " . $data['id'] . " ORDER BY waktu_update DESC";
            $r_result = $this->conn->query($riwayat_sql);
            $riwayat = [];
            while($row = $r_result->fetch_assoc()) {
                $riwayat[] = $row;
            }
            $data['riwayat'] = $riwayat;
            return $data;
        }
        return null;
    }

    public function findAllByUser($user_id) {
        $user_id = (int)$user_id;
        $sql = "SELECT p.*, l.nama_layanan FROM " . $this->table_name . " p 
                LEFT JOIN layanan l ON p.layanan_id = l.id 
                WHERE p.user_id = $user_id ORDER BY p.created_at DESC";
        $result = $this->conn->query($sql);
        $data = [];
        if($result && $result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function findAll() {
        $sql = "SELECT p.*, l.nama_layanan FROM " . $this->table_name . " p 
                LEFT JOIN layanan l ON p.layanan_id = l.id 
                ORDER BY p.created_at DESC";
        $result = $this->conn->query($sql);
        $data = [];
        if($result && $result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function findAllForKurir() {
        $sql = "SELECT p.*, l.nama_layanan FROM " . $this->table_name . " p 
                LEFT JOIN layanan l ON p.layanan_id = l.id 
                WHERE p.status IN ('menunggu_pickup', 'pickup', 'transit', 'delivery')
                ORDER BY p.created_at DESC";
        $result = $this->conn->query($sql);
        $data = [];
        if($result && $result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function findById($id) {
        $id = (int)$id;
        $sql = "SELECT * FROM " . $this->table_name . " WHERE id = $id";
        $result = $this->conn->query($sql);
        if ($result->num_rows > 0) {
            return $result->fetch_assoc();
        }
        return null;
    }

    public function updatePaymentStatus($id, $bank_ref, $amount) {
        $id = (int)$id;
        $sql = "UPDATE " . $this->table_name . " SET is_paid = TRUE, status = 'menunggu_pickup' WHERE id = $id";
        if($this->conn->query($sql)) {
            // Insert to pembayaran
            $bank_ref = $this->conn->real_escape_string($bank_ref);
            $this->conn->query("INSERT INTO pembayaran (pengiriman_id, bank_ref, amount, payment_type) VALUES ($id, '$bank_ref', $amount, 'payment_logistik')");
            $this->addRiwayat($id, 'menunggu_pickup', 'Sistem', 'Pembayaran terkonfirmasi');
            return true;
        }
        return false;
    }
    
    public function getTotalFeeLayanan() {
        $sql = "SELECT SUM(biaya_layanan) as total_fee FROM " . $this->table_name . " WHERE is_paid = TRUE";
        $result = $this->conn->query($sql);
        $data = $result->fetch_assoc();
        return $data['total_fee'] ?? 0;
    }
}
?>
