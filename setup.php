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
$conn->query("DROP DATABASE IF EXISTS logistikita");
$sql = "CREATE DATABASE logistikita";
if ($conn->query($sql) === TRUE) {
    echo "Database created successfully\n";
} else {
    echo "Error creating database: " . $conn->error . "\n";
}

$conn->select_db("logistikita");

// 1. Table users
$sql = "CREATE TABLE IF NOT EXISTS users (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'kurir', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";
$conn->query($sql);

// 2. Table layanan
$sql = "CREATE TABLE IF NOT EXISTS layanan (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    nama_layanan VARCHAR(50) NOT NULL,
    deskripsi VARCHAR(255),
    base_price DECIMAL(10,2) NOT NULL,
    estimasi_waktu VARCHAR(50)
)";
$conn->query($sql);

// 3. Table pengiriman
$sql = "CREATE TABLE IF NOT EXISTS pengiriman (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) NOT NULL,
    resi VARCHAR(50) UNIQUE NOT NULL,
    pengirim_nama VARCHAR(100),
    pengirim_telp VARCHAR(20),
    pengirim_alamat TEXT,
    penerima_nama VARCHAR(100),
    penerima_telp VARCHAR(20),
    penerima_alamat TEXT,
    berat DECIMAL(10,2),
    layanan_id INT(11),
    asuransi DECIMAL(10,2) DEFAULT 0,
    biaya_ongkir DECIMAL(15,2),
    biaya_layanan DECIMAL(15,2),
    is_paid BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (layanan_id) REFERENCES layanan(id)
)";
$conn->query($sql);

// 4. Table riwayat_status (Tracking Log)
$sql = "CREATE TABLE IF NOT EXISTS riwayat_status (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pengiriman_id INT(11) NOT NULL,
    status VARCHAR(50) NOT NULL,
    lokasi VARCHAR(100),
    keterangan TEXT,
    waktu_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pengiriman_id) REFERENCES pengiriman(id) ON DELETE CASCADE
)";
$conn->query($sql);

// 5. Table pembayaran (SmartBank Integration Log)
$sql = "CREATE TABLE IF NOT EXISTS pembayaran (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pengiriman_id INT(11) NOT NULL,
    bank_ref VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pengiriman_id) REFERENCES pengiriman(id) ON DELETE CASCADE
)";
$conn->query($sql);

// 6. Table penugasan_kurir
$sql = "CREATE TABLE IF NOT EXISTS penugasan_kurir (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    pengiriman_id INT(11) NOT NULL,
    kurir_id INT(11) NOT NULL,
    status VARCHAR(50) DEFAULT 'assigned',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pengiriman_id) REFERENCES pengiriman(id) ON DELETE CASCADE,
    FOREIGN KEY (kurir_id) REFERENCES users(id) ON DELETE CASCADE
)";
$conn->query($sql);

// Insert initial data
$password = password_hash('password123', PASSWORD_DEFAULT);
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Admin Logistikita', 'admin@logistikita.com', '$password', 'admin')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('Kurir Andalan', 'kurir@logistikita.com', '$password', 'kurir')");
$conn->query("INSERT INTO users (name, email, password, role) VALUES ('User Test', 'user@logistikita.com', '$password', 'user')");

$conn->query("INSERT INTO layanan (nama_layanan, deskripsi, base_price, estimasi_waktu) VALUES ('Logisti-Reguler', 'Pengiriman standar 2-3 hari', 10000, '2-3 Hari')");
$conn->query("INSERT INTO layanan (nama_layanan, deskripsi, base_price, estimasi_waktu) VALUES ('Logisti-Express', 'Pengiriman cepat 1 hari', 15000, '1 Hari')");
$conn->query("INSERT INTO layanan (nama_layanan, deskripsi, base_price, estimasi_waktu) VALUES ('Logisti-Priority', 'Pengiriman sameday', 25000, 'Sameday')");

echo "Database normalization completed.\n";
$conn->close();
?>
