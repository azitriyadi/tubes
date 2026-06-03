<?php
class WastePickup {
    private $conn;
    private $table_name = "pickups";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getCategoryDetails($category_name) {
        $category_id = 1; // default fallback
        $reward_per_kg = 5000;
        $processing_fee_per_kg = 500;
        $category_display_name = 'Small Gadgets'; // fallback

        $cat_sql = "SELECT id, category_name, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE ?";
        $cat_stmt = $this->conn->prepare($cat_sql);
        if ($cat_stmt) {
            $search_cat = "%" . $category_name . "%";
            $cat_stmt->bind_param("s", $search_cat);
            $cat_stmt->execute();
            $res = $cat_stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $cat_data = $res->fetch_assoc();
                $category_id = $cat_data['id'];
                $category_display_name = $cat_data['category_name'];
                $reward_per_kg = $cat_data['reward_per_kg'];
                $processing_fee_per_kg = $cat_data['processing_fee_per_kg'];
            }
            $cat_stmt->close();
        }

        return [
            'id' => $category_id,
            'category_name' => $category_display_name,
            'reward_per_kg' => (float)$reward_per_kg,
            'processing_fee_per_kg' => (float)$processing_fee_per_kg
        ];
    }

    public function create($data) {
        $tracking_number = 'ECR-' . date('Ymd') . '-' . rand(10000, 99999);
        $user_id = (int)$data['user_id'];
        $item_description = $data['item_description'] ?? '';
        $pickup_address = $data['pickup_address'] ?? '';
        $contact_phone = $data['contact_phone'] ?? '';
        $weight_kg = (float)$data['weight_kg'];
        $category_name = $data['category'] ?? '';

        // Get category info
        $cat_details = $this->getCategoryDetails($category_name);
        $category_id = $cat_details['id'];
        $reward_per_kg = $cat_details['reward_per_kg'];
        $processing_fee_per_kg = $cat_details['processing_fee_per_kg'];

        $eco_reward = $reward_per_kg * $weight_kg;
        $processing_fee = $processing_fee_per_kg * $weight_kg;

        $photo_url = $data['photo_url'] ?? null;

        $sql = "INSERT INTO " . $this->table_name . " 
                (user_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, photo_url, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')";
        
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("issssdddds", $user_id, $tracking_number, $item_description, $pickup_address, $contact_phone, $weight_kg, $category_id, $eco_reward, $processing_fee, $photo_url);
            if ($stmt->execute()) {
                $pickup_id = $this->conn->insert_id;
                $stmt->close();

                // Add to history log
                $this->addHistory($pickup_id, 'pending', 'Lokasi Masyarakat (User)', 'Permohonan penjemputan baru diajukan.');

                return [
                    'pickup_id' => $pickup_id,
                    'tracking_number' => $tracking_number,
                    'eco_reward' => $eco_reward,
                    'processing_fee' => $processing_fee,
                    'status' => 'pending'
                ];
            }
            $stmt->close();
        }
        return false;
    }

    public function addHistory($pickup_id, $status, $location, $notes) {
        $sql = "INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, ?, ?, ?)";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("isss", $pickup_id, $status, $location, $notes);
            $stmt->execute();
            $stmt->close();
            return true;
        }
        return false;
    }

    public function updateStatus($tracking_number, $status, $location = '', $notes = '') {
        $sql = "UPDATE " . $this->table_name . " SET status = ? WHERE tracking_number = ?";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("ss", $status, $tracking_number);
            if ($stmt->execute() && $this->conn->affected_rows > 0) {
                $stmt->close();
                
                // Get ID for history
                $id_sql = "SELECT id FROM " . $this->table_name . " WHERE tracking_number = ?";
                $id_stmt = $this->conn->prepare($id_sql);
                if ($id_stmt) {
                    $id_stmt->bind_param("s", $tracking_number);
                    $id_stmt->execute();
                    $res = $id_stmt->get_result();
                    if ($res->num_rows > 0) {
                        $id = $res->fetch_assoc()['id'];
                        $this->addHistory($id, $status, $location, $notes);
                    }
                    $id_stmt->close();
                }
                return true;
            }
            $stmt->close();
        }
        return false;
    }

    public function assignCollector($tracking_number, $collector_id, $location = 'Eco HQ', $notes = 'Kolektor bersiap menjemput e-waste.') {
        $sql = "UPDATE " . $this->table_name . " SET collector_id = ?, status = 'pickup' WHERE tracking_number = ?";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("is", $collector_id, $tracking_number);
            if ($stmt->execute() && $this->conn->affected_rows > 0) {
                $stmt->close();

                // Get ID for history
                $id_sql = "SELECT id FROM " . $this->table_name . " WHERE tracking_number = ?";
                $id_stmt = $this->conn->prepare($id_sql);
                if ($id_stmt) {
                    $id_stmt->bind_param("s", $tracking_number);
                    $id_stmt->execute();
                    $res = $id_stmt->get_result();
                    if ($res->num_rows > 0) {
                        $id = $res->fetch_assoc()['id'];
                        $this->addHistory($id, 'pickup', $location, $notes);
                    }
                    $id_stmt->close();
                }
                return true;
            }
            $stmt->close();
        }
        return false;
    }

    public function findByTrackingNumber($tracking_number) {
        $sql = "SELECT p.*, c.category_name, u.name AS donor_name, col.name AS collector_name 
                FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN users col ON p.collector_id = col.id
                WHERE p.tracking_number = ?";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("s", $tracking_number);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $data = $result->fetch_assoc();
                $stmt->close();
                
                // Get History
                $history_sql = "SELECT * FROM pickup_history WHERE pickup_id = ? ORDER BY updated_at DESC";
                $hist_stmt = $this->conn->prepare($history_sql);
                if ($hist_stmt) {
                    $hist_stmt->bind_param("i", $data['id']);
                    $hist_stmt->execute();
                    $h_result = $hist_stmt->get_result();
                    $history = [];
                    while ($row = $h_result->fetch_assoc()) {
                        $history[] = $row;
                    }
                    $data['history'] = $history;
                    $hist_stmt->close();
                }
                return $data;
            }
            $stmt->close();
        }
        return null;
    }

    public function findAllByUser($user_id) {
        $sql = "SELECT p.*, c.category_name 
                FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                WHERE p.user_id = ? 
                ORDER BY p.created_at DESC";
        $stmt = $this->conn->prepare($sql);
        $data = [];
        if ($stmt) {
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
            $stmt->close();
        }
        return $data;
    }

    public function findOpenPickups() {
        $sql = "SELECT p.*, c.category_name, u.name AS donor_name 
                FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending' 
                ORDER BY p.created_at DESC";
        $result = $this->conn->query($sql);
        $data = [];
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function findAllByCollector($collector_id) {
        $sql = "SELECT p.*, c.category_name, u.name AS donor_name 
                FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.collector_id = ? OR p.status = 'pending'
                ORDER BY p.created_at DESC";
        $stmt = $this->conn->prepare($sql);
        $data = [];
        if ($stmt) {
            $stmt->bind_param("i", $collector_id);
            $stmt->execute();
            $result = $stmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
            $stmt->close();
        }
        return $data;
    }

    public function findAll() {
        $sql = "SELECT p.*, c.category_name, u.name AS donor_name, col.name AS collector_name 
                FROM " . $this->table_name . " p 
                LEFT JOIN waste_categories c ON p.category_id = c.id 
                LEFT JOIN users u ON p.user_id = u.id
                LEFT JOIN users col ON p.collector_id = col.id
                ORDER BY p.created_at DESC";
        $result = $this->conn->query($sql);
        $data = [];
        if ($result && $result->num_rows > 0) {
            while ($row = $result->fetch_assoc()) {
                $data[] = $row;
            }
        }
        return $data;
    }

    public function findById($id) {
        $sql = "SELECT p.*, u.email AS donor_email FROM " . $this->table_name . " p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $data = $result->fetch_assoc();
                $stmt->close();
                return $data;
            }
            $stmt->close();
        }
        return null;
    }

    public function updateProcessingStatus($id, $transaction_ref, $amount) {
        $sql = "UPDATE " . $this->table_name . " SET is_processed = TRUE, status = 'completed' WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        if ($stmt) {
            $stmt->bind_param("i", $id);
            if ($stmt->execute()) {
                $stmt->close();
                
                // Add transaction log
                $tx_sql = "INSERT INTO transactions (pickup_id, transaction_ref, amount, transaction_type, status) VALUES (?, ?, ?, 'reward_payout', 'success')";
                $tx_stmt = $this->conn->prepare($tx_sql);
                if ($tx_stmt) {
                    $tx_stmt->bind_param("isd", $id, $transaction_ref, $amount);
                    $tx_stmt->execute();
                    $tx_stmt->close();
                }

                // Add to history log
                $this->addHistory($id, 'completed', 'Pusat Daur Ulang', 'E-Waste berhasil diproses dan reward ditransfer.');
                return true;
            }
            $stmt->close();
        }
        return false;
    }

    public function getStats() {
        $stats = [
            'total_weight' => 0.0,
            'total_reward_paid' => 0.0,
            'total_reward_pending' => 0.0,
            'total_pickups' => 0,
            'pending_verifications' => 0,
            'collectors_online' => 0
        ];

        // Total Pickups
        $res = $this->conn->query("SELECT COUNT(*) AS cnt FROM pickups");
        if ($res) $stats['total_pickups'] = (int)$res->fetch_assoc()['cnt'];

        // Pending verifications (status NOT completed and NOT processing?)
        // Let's count where status = 'pending' or status = 'pickup' or status = 'transit'
        $res = $this->conn->query("SELECT COUNT(*) AS cnt FROM pickups WHERE status = 'pending'");
        if ($res) $stats['pending_verifications'] = (int)$res->fetch_assoc()['cnt'];

        // Total weight
        $res = $this->conn->query("SELECT SUM(weight_kg) AS w FROM pickups");
        if ($res && $row = $res->fetch_assoc()) $stats['total_weight'] = (float)($row['w'] ?? 0.0);

        // Paid rewards
        $res = $this->conn->query("SELECT SUM(eco_reward) AS r FROM pickups WHERE is_processed = TRUE");
        if ($res && $row = $res->fetch_assoc()) $stats['total_reward_paid'] = (float)($row['r'] ?? 0.0);

        // Pending rewards
        $res = $this->conn->query("SELECT SUM(eco_reward) AS r FROM pickups WHERE is_processed = FALSE");
        if ($res && $row = $res->fetch_assoc()) $stats['total_reward_pending'] = (float)($row['r'] ?? 0.0);

        // Collectors online
        $res = $this->conn->query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'collector'");
        if ($res) $stats['collectors_online'] = (int)$res->fetch_assoc()['cnt'];

        return $stats;
    }
}
?>
