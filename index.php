<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Autoloader sederhana atau manual require
require_once 'app/Config/Database.php';
require_once 'app/Models/User.php';
require_once 'app/Models/Pengiriman.php';
require_once 'app/Models/SmartBank.php';
require_once 'app/Controllers/BaseController.php';
require_once 'app/Controllers/AuthController.php';
require_once 'app/Controllers/LogistikitaController.php';

$request = isset($_GET['request']) ? $_GET['request'] : '';
$request = rtrim($request, '/');

// === 1. API ROUTING ===
if (strpos($request, 'api/') === 0) {
    header("Content-Type: application/json; charset=UTF-8");
    $apiRequest = substr($request, 4); // Hilangkan awalan 'api/'
    
    $db = new Database();
    $connection = $db->getConnection();
    
    $authController = new AuthController($connection);
    $logistikitaController = new LogistikitaController($connection);

    switch ($apiRequest) {
        case 'auth/login':
            $authController->login();
            break;
        case 'auth/register':
            $authController->register();
            break;
        case 'logistikita/request_pengiriman':
            $logistikitaController->requestPengiriman();
            break;
        case 'logistikita/tracking_status':
            $logistikitaController->trackingStatus();
            break;
        case 'logistikita/biaya_pengiriman':
            $logistikitaController->biayaPengiriman();
            break;
        case 'logistikita/pembayaran_logistik':
            $logistikitaController->pembayaranLogistik();
            break;
        case 'logistikita/biaya_layanan_logistik':
            $logistikitaController->biayaLayananLogistik();
            break;
        case 'logistikita/daftar_pengiriman':
            $logistikitaController->daftarPengiriman();
            break;
        default:
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "API Endpoint not found: " . $apiRequest]);
            break;
    }
    exit();
}

// === 2. VIEWS ROUTING (FRONTEND) ===
switch ($request) {
    case '':
    case 'home':
        include 'app/Views/index.html';
        break;
    case 'auth':
    case 'login':
        include 'app/Views/login.html';
        break;
    case 'register':
        include 'app/Views/register.html';
        break;
    case 'dashboard':
        include 'app/Views/dashboard.html';
        break;
    case 'admin':
        include 'app/Views/admin.html';
        break;
    case 'kurir':
        include 'app/Views/kurir.html';
        break;
    case 'profile':
        include 'app/Views/profile.html';
        break;
    default:
        http_response_code(404);
        echo "404 Page Not Found";
        break;
}
?>
