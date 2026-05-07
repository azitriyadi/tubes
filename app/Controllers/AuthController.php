<?php
require_once 'BaseController.php';

class AuthController extends BaseController {
    private $userModel;

    public function __construct($db) {
        $this->userModel = new User($db);
    }

    public function login() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        if (empty($data['email']) || empty($data['password'])) {
            $this->sendResponse('error', 'Email and password are required.');
        }

        $user = $this->userModel->findByEmail($data['email']);
        if ($user && password_verify($data['password'], $user['password'])) {
            unset($user['password']);
            $token = base64_encode(json_encode(['id' => $user['id'], 'role' => $user['role'], 'time' => time()]));
            $user['token'] = $token;
            $this->sendResponse('success', 'Login successful.', $user);
        } else {
            $this->sendResponse('error', 'Invalid email or password.');
        }
    }

    public function register() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        if (empty($data['name']) || empty($data['email']) || empty($data['password'])) {
            $this->sendResponse('error', 'Name, email and password are required.');
        }

        $role = isset($data['role']) ? $data['role'] : 'user';
        $result = $this->userModel->create($data['name'], $data['email'], $data['password'], $role);

        if ($result === true) {
            $this->sendResponse('success', 'User registered successfully.');
        } else {
            $this->sendResponse('error', $result);
        }
    }
}
?>
