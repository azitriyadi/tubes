<?php
// EcoRecycle Database Auto-Installer & Seeder
// Konfigurasi koneksi dasar (dapat dikonfigurasi melalui variabel lingkungan untuk produksi)
$host = getenv('DB_HOST') ?: "localhost";
$user = getenv('DB_USER') ?: "root";
$pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : "";

// Buat koneksi ke server MySQL
$conn = new mysqli($host, $user, $pass);
if ($conn->connect_error) {
    die("Koneksi gagal: " . $conn->connect_error . "\nPastikan MySQL/MariaDB server Anda sudah aktif.");
}

// Buat ulang database ecorecycle
$conn->query("DROP DATABASE IF EXISTS ecorecycle");
$sql = "CREATE DATABASE ecorecycle";
if ($conn->query($sql) === TRUE) {
    echo "Database 'ecorecycle' berhasil dibuat.\n";
} else {
    die("Gagal membuat database: " . $conn->error . "\n");
}

$conn->select_db("ecorecycle");

// 1. Tabel users
$sql = "CREATE TABLE IF NOT EXISTS users (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'collector', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";
if ($conn->query($sql) === TRUE) {
    echo "Tabel 'users' berhasil dibuat.\n";
}

// 2. Tabel waste_categories
$sql = "CREATE TABLE IF NOT EXISTS waste_categories (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    reward_per_kg DECIMAL(10,2) NOT NULL,
    processing_fee_per_kg DECIMAL(10,2) NOT NULL
)";
if ($conn->query($sql) === TRUE) {
    echo "Tabel 'waste_categories' berhasil dibuat.\n";
}

// 3. Tabel pickups (Transaksi donasi utama)
$sql = "CREATE TABLE IF NOT EXISTS pickups (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) NOT NULL,
    collector_id INT(11) DEFAULT NULL,
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (collector_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES waste_categories(id)
)";
if ($conn->query($sql) === TRUE) {
    echo "Tabel 'pickups' berhasil dibuat.\n";
}

// 4. Tabel pickup_history (Log pelacakan lini masa)
$sql = "CREATE TABLE IF NOT EXISTS pickup_history (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pickup_id INT(11) NOT NULL,
    status VARCHAR(50) NOT NULL,
    location VARCHAR(100),
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pickup_id) REFERENCES pickups(id) ON DELETE CASCADE
)";
if ($conn->query($sql) === TRUE) {
    echo "Tabel 'pickup_history' berhasil dibuat.\n";
}

// 5. Tabel transactions (Log Transaksi Payout Eco-Reward)
$sql = "CREATE TABLE IF NOT EXISTS transactions (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pickup_id INT(11) NOT NULL,
    transaction_ref VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50), -- e.g., 'reward_payout'
    status VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pickup_id) REFERENCES pickups(id) ON DELETE CASCADE
)";
if ($conn->query($sql) === TRUE) {
    echo "Tabel 'transactions' berhasil dibuat.\n";
}

// Seeding data demo (Menggunakan password standard 'password123' untuk akun demo)
$password = password_hash('password123', PASSWORD_DEFAULT);
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Eco Manager', 'admin@ecorecycle.com', '$password', 'admin')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Eco Collector', 'collector@ecorecycle.com', '$password', 'collector')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Eco Warrior', 'user@ecorecycle.com', '$password', 'user')");

// Seeding kategori sampah elektronik
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Small Gadgets', 'Smartphone, Tablet, Smartwatch, Kamera Digital', 5000, 500)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Computers', 'Laptop, Motherboard, RAM, CPU', 7000, 1000)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Large Appliances', 'Televisi, Kulkas, Pendingin Ruangan (AC), Mesin Cuci', 10000, 5000)");
$conn->query("INSERT INTO waste_categories (category_name, description, reward_per_kg, processing_fee_per_kg) VALUES ('Batteries', 'Baterai Lithium-Ion, Lead-Acid, UPS Battery', 3000, 2000)");

// Seeding data transaksi donasi wilayah Bandung (Kota, Kabupaten, KBB)
// 1. Tugas Pending di Desa Lembang (Kabupaten Bandung Barat)
$conn->query("INSERT INTO pickups (id, user_id, collector_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, is_processed, status, created_at) 
VALUES (1, 3, NULL, 'ECR-20260529-01', '1 buah Laptop Asus mati total, 1 monitor LCD kedip', 'Desa Lembang, Kec. Lembang, Kabupaten Bandung Barat', '08122455667', 8.5, 2, 59500, 8500, FALSE, 'pending', '2026-05-28 10:15:00')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (1, 'pending', 'Rumah Donatur', 'Permohonan penjemputan baru diajukan.')");

// 2. Tugas Transit di Desa Bojongsoang (Kabupaten Bandung)
$conn->query("INSERT INTO pickups (id, user_id, collector_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, is_processed, status, created_at) 
VALUES (2, 3, 2, 'ECR-20260529-02', '3 buah HP layar retak, 1 tablet mati', 'Desa Bojongsoang, Kec. Bojongsoang, Kabupaten Bandung', '08778899001', 4.2, 1, 21000, 2100, FALSE, 'transit', '2026-05-28 14:30:00')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (2, 'pending', 'Rumah Donatur', 'Permohonan penjemputan baru diajukan.')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (2, 'pickup', 'Kolektor Wilayah', 'Penjemputan diambil alih oleh Kolektor: Eco Collector')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (2, 'transit', 'Di Perjalanan', 'Limbah telah diangkut oleh kolektor menuju Recycling Hub.')");

// 3. Tugas Completed di Cibeunying Kidul (Kota Bandung)
$conn->query("INSERT INTO pickups (id, user_id, collector_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, is_processed, status, created_at) 
VALUES (3, 3, 2, 'ECR-20260529-03', '1 buah TV LED Samsung 32 inch layar bergaris', 'Kelurahan Cikutra, Kec. Cibeunying Kidul, Kota Bandung', '08133445566', 15.0, 3, 150000, 75000, TRUE, 'completed', '2026-05-27 09:00:00')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (3, 'pending', 'Rumah Donatur', 'Permohonan penjemputan baru diajukan.')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (3, 'pickup', 'Kolektor Wilayah', 'Penjemputan diambil alih oleh Kolektor: Eco Collector')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (3, 'transit', 'Di Perjalanan', 'Limbah telah diangkut oleh kolektor menuju Recycling Hub.')");
$conn->query("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (3, 'completed', 'Pusat Daur Ulang', 'E-Waste berhasil diproses dan reward ditransfer.')");
$conn->query("INSERT INTO transactions (pickup_id, transaction_ref, amount, transaction_type, status) VALUES (3, 'TX-1716940800-4752', 75000, 'reward_payout', 'success')");

echo "\nInstalasi dan pengisian awal basis data EcoRecycle berhasil diselesaikan!\n";
echo "Akun Demo:\n";
echo "- Admin: admin@ecorecycle.com (password123)\n";
echo "- Collector: collector@ecorecycle.com (password123)\n";
echo "- User: user@ecorecycle.com (password123)\n";

$conn->close();
?>
