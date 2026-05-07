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
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        $required = ['user_id', 'item_description', 'pickup_address', 'contact_phone', 'weight_kg', 'category'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                $this->sendResponse('error', "Field $field is required.");
            }
        }

        $result = $this->wastePickupModel->create($data);
        if ($result) {
            $this->sendResponse('success', 'E-Waste pickup request created successfully.', $result);
        } else {
            $this->sendResponse('error', 'Failed to create pickup request.');
        }
    }

    public function pickupStatus() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = $this->getRequestData();
            if (!isset($data['tracking_number']) || !isset($data['status'])) {
                $this->sendResponse('error', 'Tracking number and new status are required.');
            }
            
            $location = isset($data['location']) ? $data['location'] : 'System';
            $notes = isset($data['notes']) ? $data['notes'] : 'Status updated';

            if ($this->wastePickupModel->updateStatus($data['tracking_number'], $data['status'], $location, $notes)) {
                $this->sendResponse('success', 'Pickup status updated.', ['tracking_number' => $data['tracking_number'], 'new_status' => $data['status']]);
            } else {
                $this->sendResponse('error', 'Tracking number not found or update failed.');
            }
        } else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (!isset($_GET['tracking_number'])) {
                $this->sendResponse('error', 'Tracking number is required.');
            }

            $data = $this->wastePickupModel->findByTrackingNumber($_GET['tracking_number']);
            if ($data) {
                $this->sendResponse('success', 'Tracking data found.', $data);
            } else {
                $this->sendResponse('error', 'Tracking number not found.');
            }
        } else {
            $this->sendResponse('error', 'Invalid request method.');
        }
    }

    public function estimateReward() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        $required = ['category', 'weight_kg'];
        foreach ($required as $field) {
            if (!isset($data[$field])) {
                $this->sendResponse('error', "Field $field is required.");
            }
        }

        $weight = (float)$data['weight_kg'];
        $category = $data['category'];
        
        // Mock calculation logic matching setup.php values
        $reward_rate = 5000;
        if (strpos(strtolower($category), 'computer') !== false) $reward_rate = 7000;
        if (strpos(strtolower($category), 'large') !== false) $reward_rate = 10000;
        if (strpos(strtolower($category), 'battery') !== false) $reward_rate = 3000;

        $total_reward = $reward_rate * $weight;

        $this->sendResponse('success', 'Eco-reward estimate calculated.', [
            'category' => $category,
            'weight_kg' => $weight,
            'reward_rate' => $reward_rate,
            'total_estimate' => $total_reward
        ]);
    }

    public function processPayout() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $data = $this->getRequestData();
        if (!isset($data['pickup_id'])) {
            $this->sendResponse('error', 'pickup_id is required.');
        }

        $pickup = $this->wastePickupModel->findById($data['pickup_id']);
        if ($pickup) {
            if ($pickup['is_processed']) {
                $this->sendResponse('error', 'This pickup reward has already been processed.');
            }

            require_once 'app/Models/SmartBank.php';
            $payout_amount = $pickup['eco_reward'];
            $smartbank_response = SmartBank::processTransaction($pickup['id'], $payout_amount, 'eco_reward_payout');

            if ($smartbank_response['status'] === 'success') {
                $this->wastePickupModel->updateProcessingStatus($pickup['id'], $smartbank_response['bank_ref'], $payout_amount);
                $this->sendResponse('success', 'Eco-reward payout processed via SmartBank.', [
                    'pickup_id' => $pickup['id'],
                    'amount_paid' => $payout_amount,
                    'bank_reference' => $smartbank_response['bank_ref']
                ]);
            } else {
                $this->sendResponse('error', 'SmartBank transaction failed.');
            }
        } else {
            $this->sendResponse('error', 'Pickup data not found.');
        }
    }

    public function listPickups() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->sendResponse('error', 'Invalid request method.');
        }

        $type = isset($_GET['type']) ? $_GET['type'] : 'all';
        $data = [];

        if($type === 'user') {
            $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
            $data = $this->wastePickupModel->findAllByUser($user_id);
        } else {
            $data = $this->wastePickupModel->findAll();
        }

        $this->sendResponse('success', 'List of e-waste pickups', $data);
    }
}
?>
