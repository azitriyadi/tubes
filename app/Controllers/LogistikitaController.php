<?php
require_once 'BaseController.php';

class LogistikitaController extends BaseController {
    private $pengirimanModel;

    public function __construct($db) {
        $this->pengirimanModel = new Pengiriman($db);
    }

    public function requestPengiriman() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        $required = ['user_id', 'penerima_nama', 'penerima_telp', 'penerima_alamat', 'berat', 'layanan', 'biaya_ongkir'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                $this->sendResponse('error', "Field $field is required.");
            }
        }

        $result = $this->pengirimanModel->create($data);
        if ($result) {
            $this->sendResponse('success', 'Request pengiriman berhasil dibuat.', $result);
        } else {
            $this->sendResponse('error', 'Gagal membuat request pengiriman.');
        }
    }

    public function trackingStatus() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = $this->getRequestData();
            if (!isset($data['resi']) || !isset($data['status'])) {
                $this->sendResponse('error', 'Resi dan status baru diperlukan.');
            }
            
            $lokasi = isset($data['lokasi']) ? $data['lokasi'] : 'System';
            $keterangan = isset($data['keterangan']) ? $data['keterangan'] : 'Status updated';

            if ($this->pengirimanModel->updateStatus($data['resi'], $data['status'], $lokasi, $keterangan)) {
                $this->sendResponse('success', 'Status pengiriman berhasil diupdate.', ['resi' => $data['resi'], 'status_baru' => $data['status']]);
            } else {
                $this->sendResponse('error', 'Resi tidak ditemukan atau gagal diupdate.');
            }
        } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (!isset($_GET['resi'])) {
                $this->sendResponse('error', 'Resi diperlukan.');
            }

            $data = $this->pengirimanModel->findByResi($_GET['resi']);
            if ($data) {
                $this->sendResponse('success', 'Data tracking ditemukan.', $data);
            } else {
                $this->sendResponse('error', 'Resi tidak ditemukan.');
            }
        } else {
            $this->sendResponse('error', 'Invalid request method.');
        }
    }

    public function biayaPengiriman() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        $required = ['asal', 'tujuan', 'berat', 'layanan'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                $this->sendResponse('error', "Field $field is required.");
            }
        }

        $berat = (float)$data['berat'];
        $layanan = $data['layanan'];
        $base_price = 10000;
        
        if (strpos(strtolower($layanan), 'express') !== false) {
            $base_price = 15000;
        } else if (strpos(strtolower($layanan), 'priority') !== false) {
            $base_price = 25000;
        }

        $biaya_ongkir = $base_price * ceil($berat);
        $asuransi = 0;
        if (isset($data['asuransi']) && $data['asuransi'] == true && isset($data['nilai_barang'])) {
            $asuransi = (float)$data['nilai_barang'] * 0.005;
        }

        $this->sendResponse('success', 'Biaya pengiriman berhasil dihitung.', [
            'asal' => $data['asal'],
            'tujuan' => $data['tujuan'],
            'berat' => $berat,
            'layanan' => $layanan,
            'biaya_ongkir' => $biaya_ongkir,
            'asuransi' => $asuransi,
            'total' => $biaya_ongkir + $asuransi
        ]);
    }

    public function pembayaranLogistik() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        if (!isset($data['pengiriman_id'])) {
            $this->sendResponse('error', 'pengiriman_id is required.');
        }

        $pengiriman = $this->pengirimanModel->findById($data['pengiriman_id']);
        if ($pengiriman) {
            if ($pengiriman['is_paid']) {
                $this->sendResponse('error', 'Pengiriman ini sudah dibayar.');
            }

            $total_bayar = $pengiriman['biaya_ongkir'] + $pengiriman['biaya_layanan'] + $pengiriman['asuransi'];
            $smartbank_response = SmartBank::processTransaction($pengiriman['id'], $total_bayar, 'payment_logistik');

            if ($smartbank_response['status'] === 'success') {
                $this->pengirimanModel->updatePaymentStatus($pengiriman['id'], $smartbank_response['bank_ref'], $total_bayar);
                $this->sendResponse('success', 'Pembayaran berhasil via SmartBank.', [
                    'pengiriman_id' => $pengiriman['id'],
                    'total_bayar' => $total_bayar,
                    'smartbank_ref' => $smartbank_response['bank_ref']
                ]);
            } else {
                $this->sendResponse('error', 'Pembayaran SmartBank gagal.');
            }
        } else {
            $this->sendResponse('error', 'Data pengiriman tidak ditemukan.');
        }
    }

    public function biayaLayananLogistik() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = $this->getRequestData();
            if (!isset($data['pengiriman_id'])) {
                $this->sendResponse('error', 'pengiriman_id is required.');
            }

            $pengiriman = $this->pengirimanModel->findById($data['pengiriman_id']);
            if ($pengiriman) {
                if (!$pengiriman['is_paid']) {
                    $this->sendResponse('error', 'Pengiriman ini belum dibayar.');
                }
                $smartbank_response = SmartBank::processTransaction($pengiriman['id'], $pengiriman['biaya_layanan'], 'fee_layanan_logistik');

                if ($smartbank_response['status'] === 'success') {
                    $this->sendResponse('success', 'Potongan fee layanan berhasil diproses.', [
                        'pengiriman_id' => $pengiriman['id'],
                        'fee_amount' => $pengiriman['biaya_layanan'],
                        'smartbank_ref' => $smartbank_response['bank_ref']
                    ]);
                } else {
                    $this->sendResponse('error', 'Pemrosesan fee SmartBank gagal.');
                }
            } else {
                $this->sendResponse('error', 'Data pengiriman tidak ditemukan.');
            }
        } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $total = $this->pengirimanModel->getTotalFeeLayanan();
            $this->sendResponse('success', 'Total pendapatan fee layanan.', ['total_fee' => $total]);
        } else {
            $this->sendResponse('error', 'Invalid request method.');
        }
    }

    public function daftarPengiriman() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $type = isset($_GET['type']) ? $_GET['type'] : 'all';
        $data = [];

        if($type === 'user') {
            $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
            $data = $this->pengirimanModel->findAllByUser($user_id);
        } else if ($type === 'kurir') {
            $data = $this->pengirimanModel->findAllForKurir();
        } else {
            $data = $this->pengirimanModel->findAll();
        }

        $this->sendResponse('success', 'Daftar pengiriman', $data);
    }
}
?>
