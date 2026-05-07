<?php
class SmartBank {
    public static function processTransaction($transaksi_id, $amount, $type = 'payment') {
        // Simulasi integrasi dengan SmartBank API
        return [
            'status' => 'success',
            'bank_ref' => 'SB-' . time() . '-' . rand(1000, 9999),
            'transaksi_id' => $transaksi_id,
            'amount' => $amount,
            'type' => $type
        ];
    }
}
?>
