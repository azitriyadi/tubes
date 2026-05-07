<?php
class WastePickup {
    private $conn;
    private $table_name = "pickups";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function create($data) {
        $tracking_number = 'ECR-' . date('Ymd') . '-' . rand(10000, 99999);
        $user_id = (int)$data['user_id'];
        $item_description = $this->conn->real_escape_string($data['item_description'] ?? '');
        $pickup_address = $this->conn->real_escape_string($data['pickup_address'] ?? '');
        $contact_phone = $this->conn->real_escape_string($data['contact_phone'] ?? '');
        $weight_kg = (float)$data['weight_kg'];
        
        // Get category info
        $category_name = $this->conn->real_escape_string($data['category']);
        $category_id = 1; // default
        $res = $this->conn->query("SELECT id, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE '%$category_name%'");
        if($res && $res->num_rows > 0) {
            $cat_data = $res->fetch_assoc();
            $category_id = $cat_data['id'];
            $reward_per_kg = $cat_data['reward_per_kg'];
            $processing_fee_per_kg = $cat_data['processing_fee_per_kg'];
        } else {
            $reward_per_kg = 5000;
            $processing_fee_per_kg = 500;
        }

        $eco_reward = $reward_per_kg * $weight_kg;
        $processing_fee = $processing_fee_per_kg * $weight_kg;

        $sql = "INSERT INTO " . $this->table_name . " 
                (user_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, status) 
                VALUES ($user_id, '$tracking_number', '$item_description', '$pickup_address', '$contact_phone', $weight_kg, $category_id, $eco_reward, $processing_fee, 'pending')";

        if ($this->conn->query($sql) === TRUE) {
            $pickup_id = $this->conn->insert_id;
            $this->addHistory($pickup_id, 'pending', 'User Home', 'Pickup request created');

            return [
                'pickup_id' => $pickup_id,
                'tracking_number' => $tracking_number,
                'eco_reward' => $eco_reward,
                'processing_fee' => $processing_fee,
                'status' => 'pending'
            ];
        }
        return false;
    }

    public function addHistory($pickup_id, $status, $location, $notes) {
        $status = $this->conn->real_escape_string($status);
        $location = $this->conn->real_escape_string($location);
        $notes = $this->conn->real_escape_string($notes);
        $sql = "INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES ($pickup_id, '$status', '$location', '$notes')";
        $this->conn->query($sql);
    }

    public function updateStatus($tracking_number, $status, $location = '', $notes = '') {
        $tracking_number = $this->conn->real_escape_string($tracking_number);
        $status = $this->conn->real_escape_string($status);
        
        $sql = "UPDATE " . $this->table_name . " SET status = '$status' WHERE tracking_number = '$tracking_number'";
        if ($this->conn->query($sql) === TRUE && $this->conn->affected_rows > 0) {
            $res = $this->conn->query("SELECT id FROM " . $this->table_name . " WHERE tracking_number = '$tracking_number'");
            if($res->num_rows > 0) {
                $id = $res->fetch_assoc()['id'];
                $this->addHistory($id, $status, $location, $notes);
            }
            return true;
        }
        return false;
    }

    public function findByTrackingNumber($tracking_number) {
        $tracking_number = $this->conn->real_escape_string($tracking_number);
        $sql = "SELECT p.*, c.category_name FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                WHERE p.tracking_number = '$tracking_number'";
        $result = $this->conn->query($sql);
        if ($result->num_rows > 0) {
            $data = $result->fetch_assoc();
            
            $history_sql = "SELECT * FROM pickup_history WHERE pickup_id = " . $data['id'] . " ORDER BY updated_at DESC";
            $h_result = $this->conn->query($history_sql);
            $history = [];
            while($row = $h_result->fetch_assoc()) {
                $history[] = $row;
            }
            $data['history'] = $history;
            return $data;
        }
        return null;
    }

    public function findAllByUser($user_id) {
        $user_id = (int)$user_id;
        $sql = "SELECT p.*, c.category_name FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
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
        $sql = "SELECT p.*, c.category_name FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
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

    public function updateProcessingStatus($id, $bank_ref, $amount) {
        $id = (int)$id;
        $sql = "UPDATE " . $this->table_name . " SET is_processed = TRUE, status = 'completed' WHERE id = $id";
        if($this->conn->query($sql)) {
            $bank_ref = $this->conn->real_escape_string($bank_ref);
            $this->conn->query("INSERT INTO transactions (pickup_id, bank_ref, amount, transaction_type) VALUES ($id, '$bank_ref', $amount, 'reward_payout')");
            $this->addHistory($id, 'completed', 'Recycling Center', 'E-Waste processed and reward paid');
            return true;
        }
        return false;
    }
}
?>
