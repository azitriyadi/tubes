<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Autoloader
require_once 'app/Config/Database.php';
require_once 'app/Models/User.php';
require_once 'app/Controllers/BaseController.php';
require_once 'app/Controllers/AuthController.php';
require_once 'app/Controllers/EcoRecycleController.php';

$request = isset($_GET['request']) ? $_GET['request'] : '';
$request = rtrim($request, '/');

// === 1. API ROUTING ===
if (strpos($request, 'api/') === 0) {
    header("Content-Type: application/json; charset=UTF-8");
    $apiRequest = substr($request, 4); // Remove 'api/'
    
    $db = new Database();
    $connection = $db->getConnection();
    
    $authController = new AuthController($connection);
    $ecoController = new EcoRecycleController($connection);

    switch ($apiRequest) {
        case 'auth/login':
            $authController->login();
            break;
        case 'auth/register':
            $authController->register();
            break;
        case 'ecorecycle/request_pickup':
            $ecoController->requestPickup();
            break;
        case 'ecorecycle/pickup_status':
            $ecoController->pickupStatus();
            break;
        case 'ecorecycle/estimate_reward':
            $ecoController->estimateReward();
            break;
        case 'ecorecycle/process_payout':
            $ecoController->processPayout();
            break;
        case 'ecorecycle/list_pickups':
            $ecoController->listPickups();
            break;
        case 'ecorecycle/assign_collector':
            $ecoController->assignCollector();
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
    case 'collector':
        include 'app/Views/collector.html';
        break;
    default:
        http_response_code(404);
        echo "404 EcoRecycle Page Not Found";
        break;
}
?>
