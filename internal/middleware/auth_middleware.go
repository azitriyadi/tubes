package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type Response struct {
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func SendResponse(w http.ResponseWriter, status string, message string, data interface{}, httpCode int) {
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.WriteHeader(httpCode)
	json.NewEncoder(w).Encode(Response{
		Status:  status,
		Message: message,
		Data:    data,
	})
}

func RequestData(r *http.Request) map[string]string {
	data := make(map[string]string)
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		var jsonMap map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&jsonMap); err == nil {
			for k, v := range jsonMap {
				switch val := v.(type) {
				case string:
					data[k] = val
				case float64:
					data[k] = fmt.Sprintf("%g", val)
				case bool:
					data[k] = fmt.Sprintf("%t", val)
				}
			}
		}
		return data
	}

	r.ParseMultipartForm(10 << 20)
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
	return data
}
