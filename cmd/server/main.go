package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"ecorecycle/internal/handlers"
	httpx "ecorecycle/internal/middleware"
	"ecorecycle/internal/services"

	_ "github.com/go-sql-driver/mysql"
)

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

func initDB() *sql.DB {
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

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Gagal membuka database: %v", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("Gagal terhubung ke MySQL database: %v", err)
	}
	log.Println("Berhasil terhubung ke database.")
	return db
}

func main() {
	loadEnv()
	db := initDB()
	defer db.Close()

	rand.Seed(time.Now().UnixNano())

	authService := services.NewAuthService(os.Getenv("JWT_SECRET"))
	app := handlers.NewApp(db, authService)
	if err := app.Users.EnsureProfileSchema(); err != nil {
		log.Fatalf("Gagal menyiapkan kolom profil payout: %v", err)
	}
	if err := app.Announcements.EnsureSchema(); err != nil {
		log.Fatalf("Gagal menyiapkan tabel CMS portal: %v", err)
	}

	mux := http.NewServeMux()

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
	mux.HandleFunc("GET /swagger", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "docs/swagger.html")
	})
	mux.HandleFunc("GET /swagger/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/swagger", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /swagger/openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=UTF-8")
		http.ServeFile(w, r, "docs/openapi.json")
	})

	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("./assets"))))
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	mux.HandleFunc("POST /api/auth/login", app.LoginHandler)
	mux.HandleFunc("POST /api/auth/register", app.RegisterHandler)
	mux.HandleFunc("GET /api/user/profile", app.ProfileGetHandler)
	mux.HandleFunc("POST /api/user/profile", app.ProfileUpdateHandler)
	mux.HandleFunc("POST /api/ecorecycle/request_pickup", app.RequestPickupHandler)
	mux.HandleFunc("GET /api/ecorecycle/pickup_status", app.PickupStatusGetHandler)
	mux.HandleFunc("POST /api/ecorecycle/pickup_status", app.PickupStatusPostHandler)
	mux.HandleFunc("POST /api/ecorecycle/assign_collector", app.AssignCollectorHandler)
	mux.HandleFunc("POST /api/ecorecycle/estimate_reward", app.EstimateRewardHandler)
	mux.HandleFunc("POST /api/ecorecycle/process_payout", app.ProcessPayoutHandler)
	mux.HandleFunc("GET /api/ecorecycle/list_pickups", app.ListPickupsHandler)
	mux.HandleFunc("GET /api/ecorecycle/announcements", app.ListAnnouncementsHandler)
	mux.HandleFunc("POST /api/ecorecycle/announcements", app.ManageAnnouncementsHandler)
	mux.HandleFunc("DELETE /api/ecorecycle/announcements", app.DeleteAnnouncementHandler)

	handler := httpx.CORS(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("EcoRecycle Server berjalan di http://localhost:%s\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
