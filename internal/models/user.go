package models

type TokenPayload struct {
	ID   int    `json:"id"`
	Role string `json:"role"`
	Name string `json:"name"`
	Exp  int64  `json:"exp"`
}

type User struct {
	ID                  int     `json:"id"`
	Name                string  `json:"name"`
	Email               string  `json:"email"`
	Password            string  `json:"-"`
	Role                string  `json:"role"`
	Phone               *string `json:"phone,omitempty"`
	Address             *string `json:"address,omitempty"`
	PayoutMethod        *string `json:"payout_method,omitempty"`
	PayoutAccountName   *string `json:"payout_account_name,omitempty"`
	PayoutAccountNumber *string `json:"payout_account_number,omitempty"`
}
