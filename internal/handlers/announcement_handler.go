package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	httpx "ecorecycle/internal/middleware"
)

func (a *App) ListAnnouncementsHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}

	items, err := a.Announcements.List(user.Role, user.Role == "admin")
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal mengambil pengumuman portal.", nil, http.StatusInternalServerError)
		return
	}
	httpx.SendResponse(w, "success", "Pengumuman portal berhasil diambil.", items, http.StatusOK)
}

func (a *App) ManageAnnouncementsHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if user.Role != "admin" {
		httpx.SendResponse(w, "error", "Akses ditolak. Perlu hak akses Administrator.", nil, http.StatusForbidden)
		return
	}

	data := httpx.RequestData(r)
	if data["action"] == "toggle" {
		id, parseErr := strconv.Atoi(data["id"])
		if parseErr != nil || id <= 0 {
			httpx.SendResponse(w, "error", "ID pengumuman tidak valid.", nil, http.StatusBadRequest)
			return
		}
		active, parseErr := strconv.ParseBool(data["is_active"])
		if parseErr != nil {
			httpx.SendResponse(w, "error", "Status pengumuman tidak valid.", nil, http.StatusBadRequest)
			return
		}
		if err := a.Announcements.SetActive(id, active); err != nil {
			status := http.StatusInternalServerError
			if err == sql.ErrNoRows {
				status = http.StatusNotFound
			}
			httpx.SendResponse(w, "error", "Pengumuman tidak ditemukan.", nil, status)
			return
		}
		httpx.SendResponse(w, "success", "Status pengumuman berhasil diperbarui.", nil, http.StatusOK)
		return
	}

	title := strings.TrimSpace(data["title"])
	message := strings.TrimSpace(data["message"])
	targetRole := data["target_role"]
	if targetRole != "all" && targetRole != "user" && targetRole != "collector" {
		targetRole = "all"
	}
	if len(title) < 3 || len(title) > 120 || len(message) < 5 || len(message) > 1000 {
		httpx.SendResponse(w, "error", "Judul harus 3-120 karakter dan isi 5-1000 karakter.", nil, http.StatusBadRequest)
		return
	}

	id, err := a.Announcements.Create(title, message, targetRole, user.ID)
	if err != nil {
		httpx.SendResponse(w, "error", "Gagal menyimpan pengumuman portal.", nil, http.StatusInternalServerError)
		return
	}
	httpx.SendResponse(w, "success", "Pengumuman berhasil diterbitkan.", map[string]interface{}{"id": id}, http.StatusCreated)
}

func (a *App) DeleteAnnouncementHandler(w http.ResponseWriter, r *http.Request) {
	user, err := a.Auth.UserFromRequest(r)
	if err != nil {
		httpx.SendResponse(w, "error", err.Error(), nil, http.StatusUnauthorized)
		return
	}
	if user.Role != "admin" {
		httpx.SendResponse(w, "error", "Akses ditolak. Perlu hak akses Administrator.", nil, http.StatusForbidden)
		return
	}

	id, parseErr := strconv.Atoi(r.URL.Query().Get("id"))
	if parseErr != nil || id <= 0 {
		httpx.SendResponse(w, "error", "ID pengumuman tidak valid.", nil, http.StatusBadRequest)
		return
	}
	if err := a.Announcements.Delete(id); err != nil {
		status := http.StatusInternalServerError
		if err == sql.ErrNoRows {
			status = http.StatusNotFound
		}
		httpx.SendResponse(w, "error", "Pengumuman tidak ditemukan.", nil, status)
		return
	}
	httpx.SendResponse(w, "success", "Pengumuman berhasil dihapus.", nil, http.StatusOK)
}
