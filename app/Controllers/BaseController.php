<?php
class BaseController {
    private static $secret_key = "EcoRecycleSecretKey_2026_SecureHMAC";

    protected function sendResponse($status, $message, $data = null, $http_code = 200) {
        http_response_code($http_code);
        echo json_encode([
            'status' => $status,
            'message' => $message,
            'data' => $data
        ]);
        exit;
    }

    protected function getRequestData() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) $data = $_POST;
        return $data;
    }

    // Menghasilkan token bertanda tangan HMAC SHA256
    protected function generateToken($user_id, $role, $name) {
        $payload = [
            'id' => $user_id,
            'role' => $role,
            'name' => $name,
            'exp' => time() + (3600 * 24) // Expire dalam 24 jam
        ];
        $encoded_payload = base64_encode(json_encode($payload));
        $signature = hash_hmac('sha256', $encoded_payload, self::$secret_key);
        return $encoded_payload . '.' . $signature;
    }

    // Memvalidasi token bertanda tangan
    protected function validateToken($token) {
        if (empty($token)) return null;
        
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;

        list($encoded_payload, $signature) = $parts;
        $expected_signature = hash_hmac('sha256', $encoded_payload, self::$secret_key);
        
        if (hash_equals($expected_signature, $signature)) {
            $payload = json_decode(base64_decode($encoded_payload), true);
            if (isset($payload['exp']) && $payload['exp'] > time()) {
                return $payload;
            }
        }
        return null;
    }

    // Mendapatkan user terautentikasi atau memberikan error 401
    protected function getAuthorizedUser() {
        $token = null;

        // 1. Cek dari Header Authorization
        $headers = array_change_key_case(getallheaders(), CASE_LOWER);
        if (isset($headers['authorization'])) {
            $authHeader = $headers['authorization'];
            if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
                $token = $matches[1];
            } else {
                $token = $authHeader;
            }
        }
        
        // 2. Cek dari $_GET atau $_POST jika di header tidak ada
        if (!$token) {
            $token = $_GET['token'] ?? $_POST['token'] ?? null;
        }

        if (!$token) {
            $this->sendResponse('error', 'Token autentikasi tidak ditemukan. Silakan login.', null, 401);
        }

        $user = $this->validateToken($token);
        if (!$user) {
            $this->sendResponse('error', 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.', null, 401);
        }

        return $user;
    }
}
?>
