package main

import (
	"bufio"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB
var jwtSecret string

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			value = strings.Trim(value, "\"'")
			if os.Getenv(key) == "" {
				os.Setenv(key, value)
			}
		}
	}
}

func initSecret() {
	jwtSecret = os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "EcoRecycleSecretKey_2026_SecureHMAC"
	}
}

func initDB() {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "root"
	}
	pass := os.Getenv("DB_PASS")
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "ecorecycle"
	}

	if !strings.Contains(host, ":") {
		host = host + ":3306"
	}

	var dsn string
	if pass == "" {
		dsn = fmt.Sprintf("%s@tcp(%s)/%s?parseTime=true", user, host, dbName)
	} else {
		dsn = fmt.Sprintf("%s:%s@tcp(%s)/%s?parseTime=true", user, pass, host, dbName)
	}

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Gagal membuka database: %v", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	err = db.Ping()
	if err != nil {
		log.Fatalf("Gagal terhubung ke MySQL database: %v", err)
	}
	log.Println("Berhasil terhubung ke database.")
}

type TokenPayload struct {
	ID   int    `json:"id"`
	Role string `json:"role"`
	Name string `json:"name"`
	Exp  int64  `json:"exp"`
}

func generateToken(userID int, role, name string) (string, error) {
	payload := TokenPayload{
		ID:   userID,
		Role: role,
		Name: name,
		Exp:  time.Now().Unix() + (3600 * 24), // 24 hours
	}
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.StdEncoding.EncodeToString(jsonBytes)

	mac := hmac.New(sha256.New, []byte(jwtSecret))
	mac.Write([]byte(encodedPayload))
	signature := hex.EncodeToString(mac.Sum(nil))

	return encodedPayload + "." + signature, nil
}

func validateToken(tokenStr string) (*TokenPayload, error) {
	if tokenStr == "" {
		return nil, fmt.Errorf("empty token")
	}
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}
	encodedPayload, signature := parts[0], parts[1]

	mac := hmac.New(sha256.New, []byte(jwtSecret))
	mac.Write([]byte(encodedPayload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(signature)) {
		return nil, fmt.Errorf("invalid signature")
	}

	decodedPayload, err := base64.StdEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, err
	}

	var payload TokenPayload
	if err := json.Unmarshal(decodedPayload, &payload); err != nil {
		return nil, err
	}

	if payload.Exp <= time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}

	return &payload, nil
}

func getAuthorizedUser(r *http.Request) (*TokenPayload, error) {
	token := ""
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		} else {
			token = authHeader
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		token = r.FormValue("token")
	}
	if token == "" {
		return nil, fmt.Errorf("token autentikasi tidak ditemukan. Silakan login.")
	}
	payload, err := validateToken(token)
	if err != nil {
		return nil, fmt.Errorf("sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.")
	}
	return payload, nil
}

type Response struct {
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func sendResponse(w http.ResponseWriter, status string, message string, data interface{}, httpCode int) {
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.WriteHeader(httpCode)
	json.NewEncoder(w).Encode(Response{
		Status:  status,
		Message: message,
		Data:    data,
	})
}

func getRequestData(r *http.Request) map[string]string {
	data := make(map[string]string)
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		var jsonMap map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&jsonMap); err == nil {
			for k, v := range jsonMap {
				if strVal, ok := v.(string); ok {
					data[k] = strVal
				} else if floatVal, ok := v.(float64); ok {
					data[k] = fmt.Sprintf("%g", floatVal)
				} else if boolVal, ok := v.(bool); ok {
					data[k] = fmt.Sprintf("%t", boolVal)
				}
			}
		}
	} else {
		r.ParseMultipartForm(10 << 20) // 10MB max
		for k, v := range r.Form {
			if len(v) > 0 {
				data[k] = v[0]
			}
		}
		for k, v := range r.PostForm {
			if len(v) > 0 {
				data[k] = v[0]
			}
		}
	}
	return data
}

// CORS Middleware wrapper
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Handlers
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := getRequestData(r)
	email := data["email"]
	password := data["password"]

	if email == "" || password == "" {
		sendResponse(w, "error", "Email dan password wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	var user struct {
		ID       int
		Name     string
		Email    string
		Password string
		Role     string
	}

	err := db.QueryRow("SELECT id, name, email, password, role FROM users WHERE email = ?", email).
		Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.Role)

	if err == sql.ErrNoRows {
		sendResponse(w, "error", "Email atau password salah.", nil, http.StatusBadRequest)
		return
	} else if err != nil {
		sendResponse(w, "error", "Kesalahan server internal.", nil, http.StatusInternalServerError)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		sendResponse(w, "error", "Email atau password salah.", nil, http.StatusBadRequest)
		return
	}

	token, err := generateToken(user.ID, user.Role, user.Name)
	if err != nil {
		sendResponse(w, "error", "Gagal menghasilkan token.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"id":    user.ID,
		"name":  user.Name,
		"email": user.Email,
		"role":  user.Role,
		"token": token,
	}

	sendResponse(w, "success", "Login berhasil.", respData, http.StatusOK)
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := getRequestData(r)
	name := data["name"]
	email := data["email"]
	password := data["password"]

	if name == "" || email == "" || password == "" {
		sendResponse(w, "error", "Nama, email, dan password wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	if !strings.Contains(email, "@") {
		sendResponse(w, "error", "Format email tidak valid.", nil, http.StatusBadRequest)
		return
	}

	if len(password) < 6 {
		sendResponse(w, "error", "Password harus minimal terdiri dari 6 karakter.", nil, http.StatusBadRequest)
		return
	}

	role := data["role"]
	if role == "" || (role != "user" && role != "collector" && role != "admin") {
		role = "user"
	}

	var existingID int
	err := db.QueryRow("SELECT id FROM users WHERE email = ?", email).Scan(&existingID)
	if err == nil {
		sendResponse(w, "error", "Email already exists.", nil, http.StatusBadRequest)
		return
	} else if err != sql.ErrNoRows {
		sendResponse(w, "error", "Kesalahan server internal.", nil, http.StatusInternalServerError)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		sendResponse(w, "error", "Gagal melakukan hash password.", nil, http.StatusInternalServerError)
		return
	}

	_, err = db.Exec("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", name, email, string(hashedPassword), role)
	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan data pengguna.", nil, http.StatusInternalServerError)
		return
	}

	sendResponse(w, "success", "Pendaftaran akun berhasil. Silakan login.", nil, http.StatusCreated)
}

func requestPickupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	err = r.ParseMultipartForm(10 << 20) // 10MB max
	var data map[string]string
	if err != nil || (r.MultipartForm != nil && len(r.MultipartForm.Value) == 0) {
		data = getRequestData(r)
	} else {
		data = make(map[string]string)
		for k, v := range r.MultipartForm.Value {
			if len(v) > 0 {
				data[k] = v[0]
			}
		}
	}

	requiredFields := []string{"item_description", "pickup_address", "contact_phone", "weight_kg", "category"}
	for _, field := range requiredFields {
		if data[field] == "" {
			sendResponse(w, "error", fmt.Sprintf("Field '%s' wajib diisi.", field), nil, http.StatusBadRequest)
			return
		}
	}

	weight, err := strconv.ParseFloat(data["weight_kg"], 64)
	if err != nil || weight <= 0 {
		sendResponse(w, "error", "Berat e-waste harus berupa angka numerik positif dan lebih besar dari 0 KG.", nil, http.StatusBadRequest)
		return
	}

	var photoURL *string
	file, header, err := r.FormFile("photo")
	if err == nil {
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
			hasher := md5.New()
			hasher.Write([]byte(fmt.Sprintf("%d%s", time.Now().UnixNano(), header.Filename)))
			newFileName := fmt.Sprintf("%s%s", hex.EncodeToString(hasher.Sum(nil)), ext)

			uploadDir := "./uploads"
			if err := os.MkdirAll(uploadDir, 0755); err == nil {
				destPath := filepath.Join(uploadDir, newFileName)
				out, err := os.Create(destPath)
				if err == nil {
					defer out.Close()
					_, err = io.Copy(out, file)
					if err == nil {
						urlStr := "uploads/" + newFileName
						photoURL = &urlStr
					}
				}
			}
		} else {
			sendResponse(w, "error", "Ekstensi file foto tidak diizinkan (Hanya JPG, JPEG, PNG, WEBP).", nil, http.StatusBadRequest)
			return
		}
	}

	categoryName := data["category"]
	var catID int
	var catDisplayName string
	var rewardPerKg, processingFeePerKg float64

	err = db.QueryRow("SELECT id, category_name, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE ?", "%"+categoryName+"%").
		Scan(&catID, &catDisplayName, &rewardPerKg, &processingFeePerKg)

	if err != nil {
		catID = 1
		catDisplayName = "Small Gadgets"
		rewardPerKg = 5000.0
		processingFeePerKg = 500.0
	}

	ecoReward := rewardPerKg * weight
	processingFee := processingFeePerKg * weight
	trackingNum := fmt.Sprintf("ECR-%s-%05d", time.Now().Format("20060102"), 10000+rand.Intn(90000))

	tx, err := db.Begin()
	if err != nil {
		sendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("INSERT INTO pickups (user_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, photo_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
		user.ID, trackingNum, data["item_description"], data["pickup_address"], data["contact_phone"], weight, catID, ecoReward, processingFee, photoURL)

	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan data penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	pickupID, err := res.LastInsertId()
	if err != nil {
		sendResponse(w, "error", "Gagal mengambil ID penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'pending', 'Lokasi Masyarakat (User)', 'Permohonan penjemputan baru diajukan.')", pickupID)
	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		sendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"pickup_id":       pickupID,
		"tracking_number": trackingNum,
		"eco_reward":      ecoReward,
		"processing_fee":  processingFee,
		"status":          "pending",
	}

	sendResponse(w, "success", "Permohonan penjemputan e-waste berhasil dibuat.", respData, http.StatusCreated)
}

func pickupStatusGetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	_, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	queryType := r.URL.Query().Get("type")
	if queryType == "stats" {
		var totalPickups int
		var pendingVerifications int
		var totalWeight float64
		var totalRewardPaid float64
		var totalRewardPending float64
		var collectorsOnline int

		db.QueryRow("SELECT COUNT(*) FROM pickups").Scan(&totalPickups)
		db.QueryRow("SELECT COUNT(*) FROM pickups WHERE status = 'pending'").Scan(&pendingVerifications)
		db.QueryRow("SELECT COALESCE(SUM(weight_kg), 0.0) FROM pickups").Scan(&totalWeight)
		db.QueryRow("SELECT COALESCE(SUM(eco_reward), 0.0) FROM pickups WHERE is_processed = TRUE").Scan(&totalRewardPaid)
		db.QueryRow("SELECT COALESCE(SUM(eco_reward), 0.0) FROM pickups WHERE is_processed = FALSE").Scan(&totalRewardPending)
		db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'collector'").Scan(&collectorsOnline)

		stats := map[string]interface{}{
			"total_weight":          totalWeight,
			"total_reward_paid":     totalRewardPaid,
			"total_reward_pending":  totalRewardPending,
			"total_pickups":         totalPickups,
			"pending_verifications": pendingVerifications,
			"collectors_online":     collectorsOnline,
		}

		sendResponse(w, "success", "Statistik e-waste berhasil diambil.", stats, http.StatusOK)
		return
	}

	trackingNum := r.URL.Query().Get("tracking_number")
	if trackingNum == "" {
		sendResponse(w, "error", "Nomor tracking wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	var p struct {
		ID             int
		UserID         int
		CollectorID    *int
		TrackingNumber string
		ItemDesc       *string
		PickupAddress  *string
		ContactPhone   *string
		WeightKg       *float64
		CategoryID     *int
		EcoReward      *float64
		ProcessingFee  *float64
		PhotoURL       *string
		IsProcessed    bool
		Status         string
		CreatedAt      time.Time
		CategoryName   *string
		DonorName      *string
		CollectorName  *string
	}

	query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name, u.name AS donor_name, col.name AS collector_name
			  FROM pickups p
			  LEFT JOIN waste_categories c ON p.category_id = c.id
			  LEFT JOIN users u ON p.user_id = u.id
			  LEFT JOIN users col ON p.collector_id = col.id
			  WHERE p.tracking_number = ?`

	err = db.QueryRow(query, trackingNum).Scan(
		&p.ID, &p.UserID, &p.CollectorID, &p.TrackingNumber, &p.ItemDesc, &p.PickupAddress,
		&p.ContactPhone, &p.WeightKg, &p.CategoryID, &p.EcoReward, &p.ProcessingFee,
		&p.PhotoURL, &p.IsProcessed, &p.Status, &p.CreatedAt, &p.CategoryName,
		&p.DonorName, &p.CollectorName,
	)

	if err == sql.ErrNoRows {
		sendResponse(w, "error", "Nomor tracking tidak ditemukan.", nil, http.StatusNotFound)
		return
	} else if err != nil {
		sendResponse(w, "error", "Kesalahan database.", nil, http.StatusInternalServerError)
		return
	}

	rows, err := db.Query("SELECT id, pickup_id, status, location, notes, updated_at FROM pickup_history WHERE pickup_id = ? ORDER BY updated_at DESC", p.ID)
	historyList := make([]map[string]interface{}, 0)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var h struct {
				ID        int
				PickupID  int
				Status    string
				Location  *string
				Notes     *string
				UpdatedAt time.Time
			}
			if err := rows.Scan(&h.ID, &h.PickupID, &h.Status, &h.Location, &h.Notes, &h.UpdatedAt); err == nil {
				historyList = append(historyList, map[string]interface{}{
					"id":         h.ID,
					"pickup_id":  h.PickupID,
					"status":     h.Status,
					"location":   h.Location,
					"notes":      h.Notes,
					"updated_at": h.UpdatedAt,
				})
			}
		}
	}

	respData := map[string]interface{}{
		"id":               p.ID,
		"user_id":          p.UserID,
		"collector_id":     p.CollectorID,
		"tracking_number":  p.TrackingNumber,
		"item_description": p.ItemDesc,
		"pickup_address":   p.PickupAddress,
		"contact_phone":    p.ContactPhone,
		"weight_kg":        p.WeightKg,
		"category_id":      p.CategoryID,
		"eco_reward":       p.EcoReward,
		"processing_fee":   p.ProcessingFee,
		"photo_url":        p.PhotoURL,
		"is_processed":     p.IsProcessed,
		"status":           p.Status,
		"created_at":       p.CreatedAt,
		"category_name":    p.CategoryName,
		"donor_name":       p.DonorName,
		"collector_name":   p.CollectorName,
		"history":          historyList,
	}

	if p.DonorName != nil {
		respData["donor_name"] = *p.DonorName
	}
	if p.CollectorName != nil {
		respData["collector_name"] = *p.CollectorName
	}

	sendResponse(w, "success", "Data pelacakan ditemukan.", respData, http.StatusOK)
}

func pickupStatusPostHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	_, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	data := getRequestData(r)
	trackingNum := data["tracking_number"]
	status := data["status"]

	if trackingNum == "" || status == "" {
		sendResponse(w, "error", "Nomor tracking dan status baru wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	location := data["location"]
	if location == "" {
		location = "System"
	}
	notes := data["notes"]
	if notes == "" {
		notes = "Status diperbarui"
	}

	tx, err := db.Begin()
	if err != nil {
		sendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("UPDATE pickups SET status = ? WHERE tracking_number = ?", status, trackingNum)
	if err != nil {
		sendResponse(w, "error", "Gagal memperbarui status.", nil, http.StatusInternalServerError)
		return
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil || rowsAffected == 0 {
		sendResponse(w, "error", "Nomor tracking tidak ditemukan atau gagal diperbarui.", nil, http.StatusBadRequest)
		return
	}

	var pickupID int
	err = tx.QueryRow("SELECT id FROM pickups WHERE tracking_number = ?", trackingNum).Scan(&pickupID)
	if err != nil {
		sendResponse(w, "error", "Gagal menemukan ID penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, ?, ?, ?)", pickupID, status, location, notes)
	if err != nil {
		sendResponse(w, "error", "Gagal mencatat riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		sendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"tracking_number": trackingNum,
		"status":          status,
	}

	sendResponse(w, "success", "Status penjemputan berhasil diperbarui.", respData, http.StatusOK)
}

func assignCollectorHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	if user.Role != "collector" && user.Role != "admin" {
		sendResponse(w, "error", "Akses ditolak. Hanya Kolektor/Admin yang dapat mengambil tugas.", nil, http.StatusForbidden)
		return
	}

	data := getRequestData(r)
	trackingNum := data["tracking_number"]
	if trackingNum == "" {
		sendResponse(w, "error", "Nomor tracking wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	collectorID := user.ID
	if user.Role == "admin" && data["collector_id"] != "" {
		if id, err := strconv.Atoi(data["collector_id"]); err == nil {
			collectorID = id
		}
	}

	var collectorName string
	err = db.QueryRow("SELECT name FROM users WHERE id = ?", collectorID).Scan(&collectorName)
	if err != nil {
		sendResponse(w, "error", "Kolektor tidak ditemukan.", nil, http.StatusBadRequest)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		sendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("UPDATE pickups SET collector_id = ?, status = 'pickup' WHERE tracking_number = ?", collectorID, trackingNum)
	if err != nil {
		sendResponse(w, "error", "Gagal menetapkan tugas penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil || rowsAffected == 0 {
		sendResponse(w, "error", "Nomor tracking tidak ditemukan atau gagal diperbarui.", nil, http.StatusBadRequest)
		return
	}

	var pickupID int
	err = tx.QueryRow("SELECT id FROM pickups WHERE tracking_number = ?", trackingNum).Scan(&pickupID)
	if err != nil {
		sendResponse(w, "error", "Gagal menemukan ID penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	notes := fmt.Sprintf("Penjemputan diambil alih oleh Kolektor: %s", collectorName)
	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'pickup', 'Kolektor Wilayah', ?)", pickupID, notes)
	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		sendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"tracking_number": trackingNum,
		"collector_id":    collectorID,
	}

	sendResponse(w, "success", "Tugas penjemputan berhasil diambil.", respData, http.StatusOK)
}

func estimateRewardHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := getRequestData(r)
	categoryName := data["category"]
	weightStr := data["weight_kg"]

	if categoryName == "" || weightStr == "" {
		sendResponse(w, "error", "Kategori dan berat (KG) wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	weight, err := strconv.ParseFloat(weightStr, 64)
	if err != nil || weight <= 0 {
		sendResponse(w, "error", "Berat harus lebih besar dari 0 KG.", nil, http.StatusBadRequest)
		return
	}

	var catDisplayName string
	var rewardPerKg, processingFeePerKg float64
	err = db.QueryRow("SELECT category_name, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE ?", "%"+categoryName+"%").
		Scan(&catDisplayName, &rewardPerKg, &processingFeePerKg)

	if err != nil {
		catDisplayName = "Small Gadgets"
		rewardPerKg = 5000.0
	}

	totalReward := rewardPerKg * weight
	co2Saved := weight * 2.5

	respData := map[string]interface{}{
		"category":       catDisplayName,
		"weight_kg":      weight,
		"reward_rate":    rewardPerKg,
		"total_estimate": totalReward,
		"co2_saved":      co2Saved,
	}

	sendResponse(w, "success", "Estimasi reward berhasil dihitung.", respData, http.StatusOK)
}

func processPayoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	if user.Role != "admin" {
		sendResponse(w, "error", "Akses ditolak. Hanya Admin/Finance yang dapat menyetujui payout.", nil, http.StatusForbidden)
		return
	}

	data := getRequestData(r)
	pickupIDStr := data["pickup_id"]
	if pickupIDStr == "" {
		sendResponse(w, "error", "pickup_id wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	pickupID, err := strconv.Atoi(pickupIDStr)
	if err != nil {
		sendResponse(w, "error", "pickup_id tidak valid.", nil, http.StatusBadRequest)
		return
	}

	var ecoReward float64
	var isProcessed bool
	err = db.QueryRow("SELECT eco_reward, is_processed FROM pickups WHERE id = ?", pickupID).Scan(&ecoReward, &isProcessed)
	if err == sql.ErrNoRows {
		sendResponse(w, "error", "Data penjemputan tidak ditemukan.", nil, http.StatusNotFound)
		return
	} else if err != nil {
		sendResponse(w, "error", "Kesalahan database.", nil, http.StatusInternalServerError)
		return
	}

	if isProcessed {
		sendResponse(w, "error", "Eco-reward untuk penjemputan ini sudah pernah diproses.", nil, http.StatusBadRequest)
		return
	}

	transactionRef := fmt.Sprintf("TX-%d-%04d", time.Now().Unix(), 1000+rand.Intn(9000))

	tx, err := db.Begin()
	if err != nil {
		sendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE pickups SET is_processed = TRUE, status = 'completed' WHERE id = ?", pickupID)
	if err != nil {
		sendResponse(w, "error", "Gagal memperbarui status penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("INSERT INTO transactions (pickup_id, transaction_ref, amount, transaction_type, status) VALUES (?, ?, ?, 'reward_payout', 'success')",
		pickupID, transactionRef, ecoReward)
	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan log transaksi.", nil, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'completed', 'Pusat Daur Ulang', 'E-Waste berhasil diproses dan reward ditransfer.')", pickupID)
	if err != nil {
		sendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		sendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"pickup_id":             pickupID,
		"amount_paid":           ecoReward,
		"transaction_reference": transactionRef,
	}

	sendResponse(w, "success", "Eco-reward payout berhasil diproses.", respData, http.StatusOK)
}

func listPickupsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		sendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := getAuthorizedUser(r)
	if err != nil {
		sendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	queryType := r.URL.Query().Get("type")
	if queryType == "" {
		queryType = "all"
	}

	var rows *sql.Rows
	var qErr error

	if queryType == "user" {
		query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name
				  FROM pickups p
				  LEFT JOIN waste_categories c ON p.category_id = c.id
				  WHERE p.user_id = ?
				  ORDER BY p.created_at DESC`
		rows, qErr = db.Query(query, user.ID)
	} else if queryType == "collector" {
		query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name, u.name AS donor_name
				  FROM pickups p
				  LEFT JOIN waste_categories c ON p.category_id = c.id
				  LEFT JOIN users u ON p.user_id = u.id
				  WHERE p.collector_id = ? OR p.status = 'pending'
				  ORDER BY p.created_at DESC`
		rows, qErr = db.Query(query, user.ID)
	} else {
		if user.Role != "admin" {
			sendResponse(w, "error", "Akses ditolak. Perlu hak akses Administrator.", nil, http.StatusForbidden)
			return
		}
		query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name, u.name AS donor_name, col.name AS collector_name
				  FROM pickups p
				  LEFT JOIN waste_categories c ON p.category_id = c.id
				  LEFT JOIN users u ON p.user_id = u.id
				  LEFT JOIN users col ON p.collector_id = col.id
				  ORDER BY p.created_at DESC`
		rows, qErr = db.Query(query)
	}

	if qErr != nil {
		sendResponse(w, "error", "Gagal mengambil data penjemputan dari database.", nil, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var userID int
		var collectorID *int
		var trackingNumber string
		var itemDesc *string
		var pickupAddress *string
		var contactPhone *string
		var weightKg *float64
		var categoryID *int
		var ecoReward *float64
		var processingFee *float64
		var photoURL *string
		var isProcessed bool
		var status string
		var createdAt time.Time
		var categoryName *string
		var donorName *string
		var collectorName *string

		var scanErr error
		if queryType == "user" {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName)
		} else if queryType == "collector" {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName, &donorName)
		} else {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName, &donorName, &collectorName)
		}

		if scanErr == nil {
			item := map[string]interface{}{
				"id":               id,
				"user_id":          userID,
				"collector_id":     collectorID,
				"tracking_number":  trackingNumber,
				"item_description": itemDesc,
				"pickup_address":   pickupAddress,
				"contact_phone":    contactPhone,
				"weight_kg":        weightKg,
				"category_id":      categoryID,
				"eco_reward":       ecoReward,
				"processing_fee":   processingFee,
				"photo_url":        photoURL,
				"is_processed":     isProcessed,
				"status":           status,
				"created_at":       createdAt,
				"category_name":    categoryName,
			}
			if donorName != nil {
				item["donor_name"] = *donorName
			} else {
				item["donor_name"] = ""
			}
			if collectorName != nil {
				item["collector_name"] = *collectorName
			} else {
				item["collector_name"] = ""
			}
			list = append(list, item)
		}
	}

	sendResponse(w, "success", "Daftar penjemputan e-waste berhasil diambil.", list, http.StatusOK)
}

func main() {
	loadEnv()
	initSecret()
	initDB()
	defer db.Close()

	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	mux := http.NewServeMux()

	// Frontend Views
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "app/Views/index.html")
			return
		}
		http.NotFound(w, r)
	})
	mux.HandleFunc("GET /home", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/index.html")
	})
	mux.HandleFunc("GET /login", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/login.html")
	})
	mux.HandleFunc("GET /register", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/register.html")
	})
	mux.HandleFunc("GET /dashboard", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/dashboard.html")
	})
	mux.HandleFunc("GET /admin", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/admin.html")
	})
	mux.HandleFunc("GET /collector", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "app/Views/collector.html")
	})

	// Static Assets (CSS, JS, Images, Uploads)
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("./assets"))))
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Web Service REST API
	mux.HandleFunc("POST /api/auth/login", loginHandler)
	mux.HandleFunc("POST /api/auth/register", registerHandler)
	mux.HandleFunc("POST /api/ecorecycle/request_pickup", requestPickupHandler)
	mux.HandleFunc("GET /api/ecorecycle/pickup_status", pickupStatusGetHandler)
	mux.HandleFunc("POST /api/ecorecycle/pickup_status", pickupStatusPostHandler)
	mux.HandleFunc("POST /api/ecorecycle/assign_collector", assignCollectorHandler)
	mux.HandleFunc("POST /api/ecorecycle/estimate_reward", estimateRewardHandler)
	mux.HandleFunc("POST /api/ecorecycle/process_payout", processPayoutHandler)
	mux.HandleFunc("GET /api/ecorecycle/list_pickups", listPickupsHandler)

	// Wrap mux with CORS middleware
	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("EcoRecycle Server berjalan di http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
