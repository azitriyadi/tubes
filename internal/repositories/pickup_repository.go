package repositories

import "database/sql"

type PickupRepository struct {
	DB *sql.DB
}

func NewPickupRepository(db *sql.DB) *PickupRepository {
	return &PickupRepository{DB: db}
}
