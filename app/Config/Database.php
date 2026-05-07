<?php
class Database {
    private $host = "localhost";
    private $user = "root";
    private $pass = "";
    private $db_name = "logistikita";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new mysqli($this->host, $this->user, $this->pass, $this->db_name);
            if ($this->conn->connect_error) {
                die(json_encode(["status" => "error", "message" => "Connection failed: " . $this->conn->connect_error]));
            }
        } catch(Exception $e) {
            echo json_encode(["status" => "error", "message" => "Connection error: " . $e->getMessage()]);
        }
        return $this->conn;
    }
}
?>
