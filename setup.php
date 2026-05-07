<?php
$host = "localhost";
$user = "root";
$pass = "";

// Create connection
$conn = new mysqli($host, $user, $pass);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Recreate database
$conn->query("DROP DATABASE IF EXISTS ecorecycle");
$sql = "CREATE DATABASE ecorecycle";
if ($conn->query($sql) === TRUE) {
    echo "Database EcoRecycle created successfully\n";
} else {
    echo "Error creating database: " . $conn->error . "\n";
}

$conn->select_db("ecorecycle");

// 1. Table users
$sql = "CREATE TABLE IF NOT EXISTS users (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'collector', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";
$conn->query($sql);

// 2. Table waste_categories
$sql = "CREATE TABLE IF NOT EXISTS waste_categories (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    reward_per_kg DECIMAL(10,2) NOT NULL,
    processing_fee_per_kg DECIMAL(10,2) NOT NULL
)";
$conn->query($sql);

// 3. Table pickups (Main transaction table)
$sql = "CREATE TABLE IF NOT EXISTS pickups (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) NOT NULL,
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    item_description TEXT,
    pickup_address TEXT,
    contact_phone VARCHAR(20),
    weight_kg DECIMAL(10,2),
    category_id INT(11),
    eco_reward DECIMAL(15,2),
    processing_fee DECIMAL(15,2),
    is_processed BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES waste_categories(id)
)";
$conn->query($sql);

// 4. Table pickup_history (Tracking Log)
$sql = "CREATE TABLE IF NOT EXISTS pickup_history (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pickup_id INT(11) NOT NULL,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pickup_id) REFERENCES pickups(id) ON DELETE CASCADE
)";
$conn->query($sql);

// 5. Table transactions (SmartBank Integration Log)
$sql = "CREATE TABLE IF NOT EXISTS transactions (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pickup_id INT(11) NOT NULL,
    bank_ref VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50), -- e.g., 'reward_payout' or 'fee_payment'
    status VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pickup_id) REFERENCES pickups(id) ON DELETE CASCADE
)";
$conn->query($sql);

// Insert initial data
$password = password_hash('password123', PASSWORD_DEFAULT);
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Eco Admin', 'admin@ecorecycle.com', '$password', 'admin')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Expert Collector', 'collector@ecorecycle.com', '$password', 'collector')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Eco Warrior', 'user@ecorecycle.com', '$password', 'user')");

$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Small Gadgets', 'Phones, Tablets, Wearables', 5000, 500)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Computers', 'Laptops, Monitors, CPU', 7000, 1000)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Large Appliances', 'Fridge, AC, Washing Machine', 10000, 5000)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Batteries', 'Li-Ion, Lead-Acid, alkaline', 3000, 2000)");

echo "EcoRecycle Database setup completed successfully.\n";
$conn->close();
?>
