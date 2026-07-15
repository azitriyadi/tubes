package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	httpx "ecorecycle/internal/middleware"
	"ecorecycle/internal/repositories"
	"ecorecycle/internal/services"

	"golang.org/x/crypto/bcrypt"
)

type App struct {
	DB            *sql.DB
	Auth          *services.AuthService
	Users         *repositories.UserRepository
	Pickups       *repositories.PickupRepository
	Announcements *repositories.AnnouncementRepository
}

func NewApp(db *sql.DB, auth *services.AuthService) *App {
	return &App{
		DB:            db,
		Auth:          auth,
		Users:         repositories.NewUserRepository(db),
		Pickups:       repositories.NewPickupRepository(db),
		Announcements: repositories.NewAnnouncementRepository(db),
	}
}

func (a *App) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := httpx.RequestData(r)
	email := data["email"]
	password := data["password"]

	if email == "" || password == "" {
		httpx.SendResponse(w, "error", "Email dan password wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	user, err := a.Users.FindByEmail(email)
	if err == sql.ErrNoRows {
		httpx.SendResponse(w, "error", "Email atau password salah.", nil, http.StatusBadRequest)
		return
	} else if err != nil {
		httpx.SendResponse(w, "error", "Kesalahan server internal.", nil, http.StatusInternalServerError)
		return
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		httpx.SendResponse(w, "error", "Email atau password salah.", nil, http.StatusBadRequest)
		return
	}

	token, err := a.Auth.GenerateToken(user.ID, user.Role, user.Name)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menghasilkan token.", nil, http.StatusInternalServerError)
		return
	}

	respData := map[string]interface{}{
		"id":                    user.ID,
		"name":                  user.Name,
		"email":                 user.Email,
		"role":                  user.Role,
		"phone":                 user.Phone,
		"address":               user.Address,
		"payout_method":         user.PayoutMethod,
		"payout_account_name":   user.PayoutAccountName,
		"payout_account_number": user.PayoutAccountNumber,
		"token":                 token,
	}

	httpx.SendResponse(w, "success", "Login berhasil.", respData, http.StatusOK)
}

func (a *App) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	data := httpx.RequestData(r)
	name := data["name"]
	email := data["email"]
	password := data["password"]

	if name == "" || email == "" || password == "" {
		httpx.SendResponse(w, "error", "Nama, email, dan password wajib diisi.", nil, http.StatusBadRequest)
		return
	}
	if !strings.Contains(email, "@") {
		httpx.SendResponse(w, "error", "Format email tidak valid.", nil, http.StatusBadRequest)
		return
	}
	if len(password) < 6 {
		httpx.SendResponse(w, "error", "Password harus minimal terdiri dari 6 karakter.", nil, http.StatusBadRequest)
		return
	}

	role := data["role"]
	if role == "" || (role != "user" && role != "collector" && role != "admin") {
		role = "user"
	}

	exists, err := a.Users.EmailExists(email)
	if err != nil {
		httpx.SendResponse(w, "error", "Kesalahan server internal.", nil, http.StatusInternalServerError)
		return
	}
	if exists {
		httpx.SendResponse(w, "error", "Email already exists.", nil, http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal melakukan hash password.", nil, http.StatusInternalServerError)
		return
	}

	if err := a.Users.Create(name, email, string(hashedPassword), role); err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan data pengguna.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Pendaftaran akun berhasil. Silakan login.", nil, http.StatusCreated)
}

func (a *App) ProfileGetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	sessionUser, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	user, err := a.Users.FindByID(sessionUser.ID)
	if err == sql.ErrNoRows {
		httpx.SendResponse(w, "error", "Pengguna tidak ditemukan.", nil, http.StatusNotFound)
		return
	} else if err != nil {
		httpx.SendResponse(w, "error", "Kesalahan server internal.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Profil berhasil diambil.", user, http.StatusOK)
}

func (a *App) ProfileUpdateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	sessionUser, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	data := httpx.RequestData(r)
	name := strings.TrimSpace(data["name"])
	phone := strings.TrimSpace(data["phone"])
	address := strings.TrimSpace(data["address"])
	payoutMethod := strings.TrimSpace(data["payout_method"])
	payoutAccountName := strings.TrimSpace(data["payout_account_name"])
	payoutAccountNumber := strings.TrimSpace(data["payout_account_number"])

	if name == "" {
		httpx.SendResponse(w, "error", "Nama lengkap wajib diisi.", nil, http.StatusBadRequest)
		return
	}
	if payoutMethod != "" && payoutMethod != "bank" && payoutMethod != "ewallet" && payoutMethod != "cash" {
		httpx.SendResponse(w, "error", "Metode payout tidak valid.", nil, http.StatusBadRequest)
		return
	}
	if payoutMethod != "" && payoutMethod != "cash" && (payoutAccountName == "" || payoutAccountNumber == "") {
		httpx.SendResponse(w, "error", "Nama penerima dan nomor rekening/e-wallet wajib diisi.", nil, http.StatusBadRequest)
		return
	}

	if err := a.Users.UpdateProfile(sessionUser.ID, name, phone, address, payoutMethod, payoutAccountName, payoutAccountNumber); err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan profil.", nil, http.StatusInternalServerError)
		return
	}

	user, err := a.Users.FindByID(sessionUser.ID)
	if err != nil {
		httpx.SendResponse(w, "error", "Profil tersimpan, tetapi gagal mengambil data terbaru.", nil, http.StatusInternalServerError)
		return
	}

	httpx.SendResponse(w, "success", "Profil dan data payout berhasil disimpan.", user, http.StatusOK)
}

func (a *App) ListCollectorsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httpx.SendResponse(w, "error", "Metode request tidak diizinkan.", nil, http.StatusMethodNotAllowed)
		return
	}
	sessionUser, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if sessionUser.Role != "admin" {
		httpx.SendResponse(w, "error", "Akses ditolak. Hanya Admin yang dapat melihat daftar kolektor.", nil, http.StatusForbidden)
		return
	}

	collectors, err := a.Users.ListCollectors()
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal mengambil daftar kolektor.", nil, http.StatusInternalServerError)
		return
	}
	httpx.SendResponse(w, "success", "Daftar kolektor berhasil diambil.", collectors, http.StatusOK)
}
