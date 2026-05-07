<?php
class User {
    private $conn;
    private $table_name = "users";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function findByEmail($email) {
        $email = $this->conn->real_escape_string($email);
        $sql = "SELECT id, name, email, password, role FROM " . $this->table_name . " WHERE email = '$email'";
        $result = $this->conn->query($sql);
        if ($result->num_rows > 0) {
            return $result->fetch_assoc();
        }
        return null;
    }

    public function create($name, $email, $password, $role) {
        $name = $this->conn->real_escape_string($name);
        $email = $this->conn->real_escape_string($email);
        $password = password_hash($password, PASSWORD_DEFAULT);
        $role = $this->conn->real_escape_string($role);

        if ($this->findByEmail($email)) {
            return "Email already exists.";
        }

        $sql = "INSERT INTO " . $this->table_name . " (name, email, password, role) VALUES ('$name', '$email', '$password', '$role')";
        if ($this->conn->query($sql) === TRUE) {
            return true;
        }
        return "Failed to insert user.";
    }
}
?>
