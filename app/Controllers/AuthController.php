<?php
require_once 'BaseController.php';

class AuthController extends BaseController {
    private $userModel;

    public function __construct($db) {
        $this->userModel = new User($db);
    }

    public function login() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        $data = $this->getRequestData();
        if (empty($data['email']) || empty($data['password'])) {
            $this->sendResponse('error', 'Email dan password wajib diisi.', null, 400);
        }

        $user = $this->userModel->findByEmail($data['email']);
        if ($user && password_verify($data['password'], $user['password'])) {
            unset($user['password']);
            
            // Hasilkan Signed Token menggunakan kunci rahasia
            $token = $this->generateToken($user['id'], $user['role'], $user['name']);
            $user['token'] = $token;

            $this->sendResponse('success', 'Login berhasil.', $user);
        } else {
            $this->sendResponse('error', 'Email atau password salah.', null, 400);
        }
    }

    public function register() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Metode request tidak diizinkan.', null, 405);
        }

        $data = $this->getRequestData();
        if (empty($data['name']) || empty($data['email']) || empty($data['password'])) {
            $this->sendResponse('error', 'Nama, email, dan password wajib diisi.', null, 400);
        }

        // Validasi format email
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $this->sendResponse('error', 'Format email tidak valid.', null, 400);
        }

        // Validasi panjang password
        if (strlen($data['password']) < 6) {
            $this->sendResponse('error', 'Password harus minimal terdiri dari 6 karakter.', null, 400);
        }

        $role = isset($data['role']) ? $data['role'] : 'user';
        
        // Batasi pembuatan role agar aman
        if (!in_array($role, ['user', 'collector', 'admin'])) {
            $role = 'user';
        }

        $result = $this->userModel->create($data['name'], $data['email'], $data['password'], $role);

        if ($result === true) {
            $this->sendResponse('success', 'Pendaftaran akun berhasil. Silakan login.', null, 201);
        } else {
            $this->sendResponse('error', $result, null, 400);
        }
    }
}
?>
