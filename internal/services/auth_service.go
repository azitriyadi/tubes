package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ecorecycle/internal/models"
)

type AuthService struct {
	secret string
}

func NewAuthService(secret string) *AuthService {
	if secret == "" {
		secret = "EcoRecycleSecretKey_2026_SecureHMAC"
	}
	return &AuthService{secret: secret}
}

func (s *AuthService) GenerateToken(userID int, role, name string) (string, error) {
	payload := models.TokenPayload{
		ID:   userID,
		Role: role,
		Name: name,
		Exp:  time.Now().Unix() + (3600 * 24),
	}
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.StdEncoding.EncodeToString(jsonBytes)

	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(encodedPayload))
	signature := hex.EncodeToString(mac.Sum(nil))

	return encodedPayload + "." + signature, nil
}

func (s *AuthService) ValidateToken(tokenStr string) (*models.TokenPayload, error) {
	if tokenStr == "" {
		return nil, fmt.Errorf("empty token")
	}
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}
	encodedPayload, signature := parts[0], parts[1]

	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(encodedPayload))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSignature), []byte(signature)) {
		return nil, fmt.Errorf("invalid signature")
	}

	decodedPayload, err := base64.StdEncoding.DecodeString(encodedPayload)
	if err != nil {
		return nil, err
	}

	var payload models.TokenPayload
	if err := json.Unmarshal(decodedPayload, &payload); err != nil {
		return nil, err
	}
	if payload.Exp <= time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}

	return &payload, nil
}

func (s *AuthService) UserFromRequest(r *http.Request) (*models.TokenPayload, error) {
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
		return nil, fmt.Errorf("token autentikasi tidak ditemukan. Silakan login")
	}
	payload, err := s.ValidateToken(token)
	if err != nil {
		return nil, fmt.Errorf("sesi tidak valid atau telah kedaluwarsa. Silakan login kembali")
	}
	return payload, nil
}
