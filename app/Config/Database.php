<?php
class Database {
    private $host;
    private $user;
    private $pass;
    private $db_name;
    public $conn;

    public function __construct() {
        // Mendapatkan kredensial dari environment variable jika tersedia, jika tidak gunakan default localhost
        $this->host = getenv('DB_HOST') ?: "localhost";
        $this->user = getenv('DB_USER') ?: "root";
        $this->pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : "";
        $this->db_name = getenv('DB_NAME') ?: "ecorecycle";
    }

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new mysqli($this->host, $this->user, $this->pass, $this->db_name);
            if ($this->conn->connect_error) {
                die(json_encode(["status" => "error", "message" => "Connection failed: " . $this->conn->connect_error]));
            }
        } catch(Exception $e) {
            echo json_encode(["status" => "error", "message" => "Connection error: " . $e->getMessage()]);
            exit();
        }
        return $this->conn;
    }
}
?>
