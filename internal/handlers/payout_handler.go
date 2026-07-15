package handlers

import (
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	httpx "ecorecycle/internal/middleware"
	"ecorecycle/internal/models"
	"ecorecycle/internal/services"
)

func (a *App) EstimateRewardHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := httpx.RequestData(r)
	categoryName := data["category"]
	weightStr := data["weight_kg"]
	if categoryName == "" || weightStr == "" {
		httpx.SendResponse(w, "error", "Kategori dan berat (KG) wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	weight, err := strconv.ParseFloat(weightStr, 64)
	if err != nil || weight <= 0 {
		httpx.SendResponse(w, "error", "Berat harus lebih besar dari 0 KG.", nil, http.StatusBadRequest)
		return
	}

	var catDisplayName string
	var rewardPerKg, processingFeePerKg float64
	err = a.DB.QueryRow("SELECT category_name, reward_per_kg, processing_fee_per_kg FROM waste_categories WHERE category_name LIKE ?", "%"+categoryName+"%").
		Scan(&catDisplayName, &rewardPerKg, &processingFeePerKg)
	if err != nil {
		catDisplayName = "Small Gadgets"
		rewardPerKg = 5000.0
	}

	totalReward := rewardPerKg * weight
	httpx.SendResponse(w, "success", "Estimasi reward berhasil dihitung.", map[string]interface{}{
		"category":       catDisplayName,
		"weight_kg":      weight,
		"reward_rate":    rewardPerKg,
		"total_estimate": totalReward,
		"co2_saved":      services.CO2Saved(weight),
	}, http.StatusOK)
}

func (a *App) ProcessPayoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if user.Role != "admin" {
		httpx.SendResponse(w, "error", "Akses ditolak. Hanya Admin/Finance yang dapat menyetujui payout.", nil, http.StatusForbidden)
		return
	}

	data := httpx.RequestData(r)
	pickupIDStr := data["pickup_id"]
	if pickupIDStr == "" {
		httpx.SendResponse(w, "error", "pickup_id wajib diisi.", nil, http.StatusBadRequest)
		return
	}
	pickupID, err := strconv.Atoi(pickupIDStr)
	if err != nil {
		httpx.SendResponse(w, "error", "pickup_id tidak valid.", nil, http.StatusBadRequest)
		return
	}

	var ecoReward float64
	var isProcessed bool
	var pickupStatus string
	err = a.DB.QueryRow("SELECT eco_reward, is_processed, status FROM pickups WHERE id = ?", pickupID).Scan(&ecoReward, &isProcessed, &pickupStatus)
	if err == sql.ErrNoRows {
		httpx.SendResponse(w, "error", "Data penjemputan tidak ditemukan.", nil, http.StatusNotFound)
		return
	} else if err != nil {
		httpx.SendResponse(w, "error", "Kesalahan database.", nil, http.StatusInternalServerError)
		return
	}

	if isProcessed {
		httpx.SendResponse(w, "error", "Eco-reward untuk penjemputan ini sudah pernah diproses.", nil, http.StatusBadRequest)
		return
	}
	if pickupStatus != models.StatusArrived {
		httpx.SendResponse(w, "error", "Payout hanya dapat diproses setelah e-waste tiba di Recycling Hub.", nil, http.StatusBadRequest)
		return
	}

	transactionRef := fmt.Sprintf("TX-%d-%04d", time.Now().Unix(), 1000+rand.Intn(9000))
	tx, err := a.DB.Begin()
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal memulai transaksi.", nil, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("UPDATE pickups SET is_processed = TRUE, status = 'completed' WHERE id = ?", pickupID)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal memperbarui status penjemputan.", nil, http.StatusInternalServerError)
		return
	}
	_, err = tx.Exec("INSERT INTO transactions (pickup_id, transaction_ref, amount, transaction_type, status) VALUES (?, ?, ?, 'reward_payout', 'success')",
		pickupID, transactionRef, ecoReward)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan log transaksi.", nil, http.StatusInternalServerError)
		return
	}
	_, err = tx.Exec("INSERT INTO pickup_history (pickup_id, status, location, notes) VALUES (?, 'completed', 'Pusat Daur Ulang', 'E-Waste berhasil diproses dan reward ditransfer.')", pickupID)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan riwayat penjemputan.", nil, http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(); err != nil {
		httpx.SendResponse(w, "error", "Gagal commit transaksi.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Eco-reward payout berhasil diproses.", map[string]interface{}{
		"pickup_id":             pickupID,
		"amount_paid":           ecoReward,
		"transaction_reference": transactionRef,
	}, http.StatusOK)
}
