package handlers

import (
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	httpx "ecorecycle/internal/middleware"
	"ecorecycle/internal/models"
)

func (a *App) RequestPickupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if user.Role != "user" {
		httpx.SendResponse(w, "error", "Akses ditolak. Pengajuan penjemputan hanya dapat dibuat oleh Eco Warrior.", nil, http.StatusForbidden)
		return
	}

	err = r.ParseMultipartForm(10 << 20)
	var data map[string]string
	if err != nil || (r.MultipartForm != nil && len(r.MultipartForm.Value) == 0) {
		data = httpx.RequestData(r)
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
			httpx.SendResponse(w, "error", fmt.Sprintf("Field '%s' wajib diisi.", field), nil, http.StatusBadRequest)
			return
		}
	}

	weight, err := strconv.ParseFloat(data["weight_kg"], 64)
	if err != nil || weight <= 0 {
		httpx.SendResponse(w, "error", "Berat e-waste harus berupa angka numerik positif dan lebih besar dari 0 KG.", nil, http.StatusBadRequest)
		return
	}

	var photoURL *string
	file, header, err := r.FormFile("photo")
	if err == nil {
		defer file.Close()
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
			httpx.SendResponse(w, "error", "Ekstensi file foto tidak diizinkan (Hanya JPG, JPEG, PNG, WEBP).", nil, http.StatusBadRequest)
			return
		}

		hasher := md5.New()
		hasher.Write([]byte(fmt.Sprintf("%d%s", time.Now().UnixNano(), header.Filename)))
		newFileName := fmt.Sprintf("%s%s", hex.EncodeToString(hasher.Sum(nil)), ext)

		uploadDir := "./uploads"
		if err := os.MkdirAll(uploadDir, 0755); err == nil {
			destPath := filepath.Join(uploadDir, newFileName)
			out, err := os.Create(destPath)
			if err == nil {
				defer out.Close()
				if _, err = io.Copy(out, file); err == nil {
					urlStr := "uploads/" + newFileName
					photoURL = &urlStr
				}
			}
		}
	}

	categoryName := data["category"]
	var catID int
	var catDisplayName string
	var rewardPerKg, processingFeePerKg float64

	err = a.DB.QueryRow("SELECT id, category_name, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE ?", "%"+categoryName+"%").
		Scan(&catID, &catDisplayName, &rewardPerKg, &processingFeePerKg)
	if err != nil {
		catID = 1
		rewardPerKg = 5000.0
		processingFeePerKg = 500.0
	}

	ecoReward := rewardPerKg * weight
	processingFee := processingFeePerKg * weight
	trackingNum := fmt.Sprintf("ECR-%s-%05d", time.Now().Format("20060102"), 10000+rand.Intn(90000))

	tx, err := a.DB.Begin()
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("INSERT INTO pickups (user_id, tracking_number, item_description, pickup_address, contact_phone, weight_kg, category_id, eco_reward, processing_fee, photo_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
		user.ID, trackingNum, data["item_description"], data["pickup_address"], data["contact_phone"], weight, catID, ecoReward, processingFee, photoURL)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan data penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	pickupID, err := res.LastInsertId()
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal mengambil ID penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'pending', 'Lokasi Masyarakat (User)', 'Permohonan penjemputan baru diajukan.')", pickupID)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.SendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Permohonan penjemputan e-waste berhasil dibuat.", map[string]interface{}{
		"pickup_id":       pickupID,
		"tracking_number": trackingNum,
		"eco_reward":      ecoReward,
		"processing_fee":  processingFee,
		"status":          models.StatusPending,
	}, http.StatusCreated)
}

func (a *App) ListPickupsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
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
		rows, qErr = a.DB.Query(query, user.ID)
	} else if queryType == "collector" {
		query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name, u.name AS donor_name
				  FROM pickups p
				  LEFT JOIN waste_categories c ON p.category_id = c.id
				  LEFT JOIN users u ON p.user_id = u.id
				  WHERE p.collector_id = ? OR p.status = 'pending'
				  ORDER BY p.created_at DESC`
		rows, qErr = a.DB.Query(query, user.ID)
	} else {
		if user.Role != "admin" {
			httpx.SendResponse(w, "error", "Akses ditolak. Perlu hak akses Administrator.", nil, http.StatusForbidden)
			return
		}
		query := `SELECT p.id, p.user_id, p.collector_id, p.tracking_number, p.item_description, p.pickup_address, p.contact_phone, p.weight_kg, p.category_id, p.eco_reward, p.processing_fee, p.photo_url, p.is_processed, p.status, p.created_at, c.category_name, u.name AS donor_name, col.name AS collector_name, u.payout_method, u.payout_account_name, u.payout_account_number
				  FROM pickups p
				  LEFT JOIN waste_categories c ON p.category_id = c.id
				  LEFT JOIN users u ON p.user_id = u.id
				  LEFT JOIN users col ON p.collector_id = col.id
				  ORDER BY p.created_at DESC`
		rows, qErr = a.DB.Query(query)
	}

	if qErr != nil {
		httpx.SendResponse(w, "error", "Gagal mengambil data penjemputan dari database.", nil, http.StatusInternalServerError)
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
		var payoutMethod *string
		var payoutAccountName *string
		var payoutAccountNumber *string

		var scanErr error
		if queryType == "user" {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName)
		} else if queryType == "collector" {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName, &donorName)
		} else {
			scanErr = rows.Scan(&id, &userID, &collectorID, &trackingNumber, &itemDesc, &pickupAddress, &contactPhone, &weightKg, &categoryID, &ecoReward, &processingFee, &photoURL, &isProcessed, &status, &createdAt, &categoryName, &donorName, &collectorName, &payoutMethod, &payoutAccountName, &payoutAccountNumber)
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
			if payoutMethod != nil {
				item["payout_method"] = *payoutMethod
			} else {
				item["payout_method"] = ""
			}
			if payoutAccountName != nil {
				item["payout_account_name"] = *payoutAccountName
			} else {
				item["payout_account_name"] = ""
			}
			if payoutAccountNumber != nil {
				item["payout_account_number"] = *payoutAccountNumber
			} else {
				item["payout_account_number"] = ""
			}
			list = append(list, item)
		}
	}

	httpx.SendResponse(w, "success", "Daftar penjemputan e-waste berhasil diambil.", list, http.StatusOK)
}

func (a *App) AssignCollectorHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if user.Role != "collector" && user.Role != "admin" {
		httpx.SendResponse(w, "error", "Akses ditolak. Hanya Kolektor/Admin yang dapat mengambil tugas.", nil, http.StatusForbidden)
		return
	}

	data := httpx.RequestData(r)
	trackingNum := data["tracking_number"]
	if trackingNum == "" {
		httpx.SendResponse(w, "error", "Nomor tracking wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	collectorID := user.ID
	if user.Role == "admin" && data["collector_id"] != "" {
		if id, err := strconv.Atoi(data["collector_id"]); err == nil {
			collectorID = id
		}
	}

	var collectorName string
	err = a.DB.QueryRow("SELECT name FROM users WHERE id = ?", collectorID).Scan(&collectorName)
	if err != nil {
		httpx.SendResponse(w, "error", "Kolektor tidak ditemukan.", nil, http.StatusBadRequest)
		return
	}

	tx, err := a.DB.Begin()
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("UPDATE pickups SET collector_id = ?, status = 'pickup' WHERE tracking_number = ? AND status = 'pending'", collectorID, trackingNum)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menetapkan tugas penjemputan.", nil, http.StatusInternalServerError)
		return
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil || rowsAffected == 0 {
		httpx.SendResponse(w, "error", "Tugas tidak tersedia. Pastikan nomor tracking valid dan masih berstatus pending.", nil, http.StatusBadRequest)
		return
	}

	var pickupID int
	err = tx.QueryRow("SELECT id FROM pickups WHERE tracking_number = ?", trackingNum).Scan(&pickupID)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menemukan ID penjemputan.", nil, http.StatusInternalServerError)
		return
	}

	notes := fmt.Sprintf("Penjemputan diambil alih oleh Kolektor: %s", collectorName)
	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'pickup', 'Kolektor Wilayah', ?)", pickupID, notes)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.SendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Tugas penjemputan berhasil diambil.", map[string]interface{}{
		"tracking_number": trackingNum,
		"collector_id":    collectorID,
	}, http.StatusOK)
}
