package main

import (
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"chatnet/internal/authx"
	"chatnet/internal/httpx"
	"github.com/jackc/pgx/v5"
)

const marketPaymentPending = "awaiting_payment_configuration"

var marketKey = regexp.MustCompile("^[A-Za-z0-9_-]{8,100}$")
var marketUnit = regexp.MustCompile("^[A-Z]{2,16}$")

type marketProduct struct {
	ID          int64  `json:"id"`
	SellerID    int64  `json:"sellerId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	PriceAmount int64  `json:"priceAmount"`
	PriceUnit   string `json:"priceUnit"`
	Stock       int    `json:"stock"`
	Status      string `json:"status"`
}
type marketCartLine struct {
	marketProduct
	Quantity int `json:"quantity"`
}
type marketOrder struct {
	ID          int64  `json:"id"`
	SellerID    int64  `json:"sellerId"`
	AmountTotal int64  `json:"amountTotal"`
	PriceUnit   string `json:"priceUnit"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

func (s *server) mountMarketplace(mux *http.ServeMux) {
	add := func(method, path string, h http.HandlerFunc) {
		mux.Handle(method+" "+path, authx.Middleware(s.jwtSecret, h))
	}
	add("GET", "/api/marketplace/products", s.marketProducts)
	add("GET", "/api/marketplace/products/mine", s.marketProductsMine)
	add("POST", "/api/marketplace/products", s.marketDraft)
	add("POST", "/api/marketplace/products/{id}/publish", s.marketPublish)
	add("GET", "/api/marketplace/cart", s.marketCart)
	add("PUT", "/api/marketplace/cart/{id}", s.marketPutCart)
	add("DELETE", "/api/marketplace/cart/{id}", s.marketDeleteCart)
	add("POST", "/api/marketplace/orders", s.marketCheckout)
	add("GET", "/api/marketplace/orders", s.marketOrders)
}
func marketUser(r *http.Request) int64 {
	c, _ := authx.ClaimsFromContext(r.Context())
	return c.UserID
}
func marketBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	d := json.NewDecoder(io.LimitReader(r.Body, 32769))
	d.DisallowUnknownFields()
	if d.Decode(dst) != nil {
		httpx.Error(w, 400, "invalid JSON")
		return false
	}
	var extra any
	if err := d.Decode(&extra); !errors.Is(err, io.EOF) {
		httpx.Error(w, 400, "invalid JSON or body too large")
		return false
	}
	return true
}
func marketID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}
func marketPage(r *http.Request) (int64, int, bool) {
	before := int64(math.MaxInt64)
	limit := 30
	if v := r.URL.Query().Get("before"); v != "" {
		x, e := strconv.ParseInt(v, 10, 64)
		if e != nil || x <= 0 {
			return 0, 0, false
		}
		before = x
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		x, e := strconv.Atoi(v)
		if e != nil || x < 1 || x > 50 {
			return 0, 0, false
		}
		limit = x
	}
	return before, limit, true
}
func (s *server) marketProducts(w http.ResponseWriter, r *http.Request) {
	s.marketListProducts(w, r, false)
}
func (s *server) marketProductsMine(w http.ResponseWriter, r *http.Request) {
	s.marketListProducts(w, r, true)
}
func (s *server) marketListProducts(w http.ResponseWriter, r *http.Request, mine bool) {
	before, limit, ok := marketPage(r)
	if !ok {
		httpx.Error(w, 400, "invalid pagination")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,seller_id,title,description,price_amount,price_unit,stock,status
 FROM market_products WHERE id<$1 AND (($2 AND seller_id=$3) OR (NOT $2 AND status='published'))
 ORDER BY id DESC LIMIT $4`, before, mine, marketUser(r), limit)
	if err != nil {
		httpx.Error(w, 500, "unable to load products")
		return
	}
	defer rows.Close()
	products := make([]marketProduct, 0)
	for rows.Next() {
		var p marketProduct
		if rows.Scan(&p.ID, &p.SellerID, &p.Title, &p.Description, &p.PriceAmount, &p.PriceUnit, &p.Stock, &p.Status) != nil {
			httpx.Error(w, 500, "unable to load products")
			return
		}
		products = append(products, p)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "unable to load products")
		return
	}
	httpx.JSON(w, 200, map[string]any{"products": products})
}
func (s *server) marketDraft(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		PriceAmount int64  `json:"priceAmount"`
		PriceUnit   string `json:"priceUnit"`
		Stock       int    `json:"stock"`
	}
	if !marketBody(w, r, &b) {
		return
	}
	b.Title = strings.TrimSpace(b.Title)
	b.PriceUnit = strings.ToUpper(strings.TrimSpace(b.PriceUnit))
	if len([]rune(b.Title)) < 2 || len([]rune(b.Title)) > 160 || len([]rune(b.Description)) > 4000 || b.PriceAmount <= 0 ||
		!marketUnit.MatchString(b.PriceUnit) || b.Stock < 0 || b.Stock > 1000000 {
		httpx.Error(w, 400, "invalid product")
		return
	}
	var id int64
	err := s.db.QueryRow(r.Context(), `INSERT INTO market_products(seller_id,title,description,price_amount,price_unit,stock)
 VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, marketUser(r), b.Title, b.Description, b.PriceAmount, b.PriceUnit, b.Stock).Scan(&id)
	if err != nil {
		httpx.Error(w, 500, "unable to create draft")
		return
	}
	httpx.JSON(w, 201, map[string]any{"id": id, "status": "draft", "requiresSellerConfirmation": true})
}
func (s *server) marketPublish(w http.ResponseWriter, r *http.Request) {
	id, ok := marketID(r)
	if !ok {
		httpx.Error(w, 400, "invalid id")
		return
	}
	var published int64
	err := s.db.QueryRow(r.Context(), `UPDATE market_products SET status='published',updated_at=NOW()
 WHERE id=$1 AND seller_id=$2 AND status='draft' RETURNING id`, id, marketUser(r)).Scan(&published)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "draft not found")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "unable to publish")
		return
	}
	httpx.JSON(w, 200, map[string]any{"id": published, "status": "published"})
}
func (s *server) marketCart(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `SELECT p.id,p.seller_id,p.title,p.description,p.price_amount,p.price_unit,p.stock,p.status,c.quantity
 FROM market_cart_items c JOIN market_products p ON p.id=c.product_id
 WHERE c.buyer_id=$1 ORDER BY c.updated_at DESC LIMIT 200`, marketUser(r))
	if err != nil {
		httpx.Error(w, 500, "unable to load cart")
		return
	}
	defer rows.Close()
	items := make([]marketCartLine, 0)
	for rows.Next() {
		var v marketCartLine
		if rows.Scan(&v.ID, &v.SellerID, &v.Title, &v.Description, &v.PriceAmount, &v.PriceUnit, &v.Stock, &v.Status, &v.Quantity) != nil {
			httpx.Error(w, 500, "unable to load cart")
			return
		}
		items = append(items, v)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "unable to load cart")
		return
	}
	httpx.JSON(w, 200, map[string]any{"items": items})
}
func (s *server) marketPutCart(w http.ResponseWriter, r *http.Request) {
	id, ok := marketID(r)
	if !ok {
		httpx.Error(w, 400, "invalid id")
		return
	}
	var b struct {
		Quantity int `json:"quantity"`
	}
	if !marketBody(w, r, &b) {
		return
	}
	if b.Quantity < 1 || b.Quantity > 99 {
		httpx.Error(w, 400, "invalid quantity")
		return
	}
	tag, err := s.db.Exec(r.Context(), `INSERT INTO market_cart_items(buyer_id,product_id,quantity)
 SELECT $1,p.id,$3 FROM market_products p WHERE p.id=$2 AND p.seller_id<>$1
 AND p.status='published' AND p.stock >= $3
 ON CONFLICT(buyer_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=NOW()`,
		marketUser(r), id, b.Quantity)
	if err != nil {
		httpx.Error(w, 500, "unable to update cart")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, 409, "product unavailable")
		return
	}
	w.WriteHeader(204)
}
func (s *server) marketDeleteCart(w http.ResponseWriter, r *http.Request) {
	id, ok := marketID(r)
	if !ok {
		httpx.Error(w, 400, "invalid id")
		return
	}
	_, err := s.db.Exec(r.Context(), `DELETE FROM market_cart_items WHERE buyer_id=$1 AND product_id=$2`, marketUser(r), id)
	if err != nil {
		httpx.Error(w, 500, "unable to update cart")
		return
	}
	w.WriteHeader(204)
}

type marketQuoteLine struct {
	ID       int64
	Title    string
	Price    int64
	Unit     string
	Stock    int
	Quantity int
}

func marketQuote(lines []marketQuoteLine) (int64, string, error) {
	if len(lines) == 0 {
		return 0, "", errors.New("empty cart")
	}
	var total int64
	unit := lines[0].Unit
	for _, l := range lines {
		if l.Price <= 0 || l.Quantity < 1 || l.Quantity > 99 || l.Quantity > l.Stock || l.Unit != unit {
			return 0, "", errors.New("unavailable items")
		}
		if l.Price > math.MaxInt64/int64(l.Quantity) {
			return 0, "", errors.New("overflow")
		}
		lineTotal := l.Price * int64(l.Quantity)
		if total > math.MaxInt64-lineTotal {
			return 0, "", errors.New("overflow")
		}
		total += lineTotal
	}
	return total, unit, nil
}
func (s *server) marketCheckout(w http.ResponseWriter, r *http.Request) {
	var b struct {
		SellerID       int64  `json:"sellerId"`
		IdempotencyKey string `json:"idempotencyKey"`
	}
	if !marketBody(w, r, &b) {
		return
	}
	buyer := marketUser(r)
	if b.SellerID <= 0 || b.SellerID == buyer || !marketKey.MatchString(b.IdempotencyKey) {
		httpx.Error(w, 400, "invalid checkout")
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	defer tx.Rollback(ctx)
	var existing int64
	err = tx.QueryRow(ctx, `SELECT id FROM market_orders WHERE buyer_id=$1 AND idempotency_key=$2`, buyer, b.IdempotencyKey).Scan(&existing)
	if err == nil {
		if tx.Commit(ctx) != nil {
			httpx.Error(w, 500, "checkout unavailable")
			return
		}
		httpx.JSON(w, 200, map[string]any{"id": existing, "status": marketPaymentPending})
		return
	}
	if err != pgx.ErrNoRows {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	rows, err := tx.Query(ctx, `SELECT p.id,p.title,p.price_amount,p.price_unit,p.stock,c.quantity
 FROM market_cart_items c JOIN market_products p ON p.id=c.product_id
 WHERE c.buyer_id=$1 AND p.seller_id=$2 AND p.status='published'
 ORDER BY p.id FOR SHARE OF p`, buyer, b.SellerID)
	if err != nil {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	lines := make([]marketQuoteLine, 0)
	for rows.Next() {
		var l marketQuoteLine
		if err = rows.Scan(&l.ID, &l.Title, &l.Price, &l.Unit, &l.Stock, &l.Quantity); err != nil {
			break
		}
		lines = append(lines, l)
	}
	if rows.Err() != nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	total, unit, err := marketQuote(lines)
	if err != nil {
		httpx.Error(w, 409, "invalid cart or price unit mismatch")
		return
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO market_orders(buyer_id,seller_id,idempotency_key,amount_total,price_unit,status)
 VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(buyer_id,idempotency_key) DO NOTHING RETURNING id`, buyer, b.SellerID, b.IdempotencyKey, total, unit, marketPaymentPending).Scan(&id)
	if err == pgx.ErrNoRows {
		err = tx.QueryRow(ctx, `SELECT id FROM market_orders WHERE buyer_id=$1 AND idempotency_key=$2`, buyer, b.IdempotencyKey).Scan(&id)
		if err == nil && tx.Commit(ctx) == nil {
			httpx.JSON(w, 200, map[string]any{"id": id, "status": marketPaymentPending})
			return
		}
		httpx.Error(w, 409, "duplicate checkout")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	for _, l := range lines {
		_, err = tx.Exec(ctx, `INSERT INTO market_order_items(order_id,product_id,title,unit_price,quantity)
 VALUES($1,$2,$3,$4,$5)`, id, l.ID, l.Title, l.Price, l.Quantity)
		if err != nil {
			httpx.Error(w, 500, "checkout unavailable")
			return
		}
	}
	if tx.Commit(ctx) != nil {
		httpx.Error(w, 500, "checkout unavailable")
		return
	}
	// Preview-only until owner chooses Coin/VND/other, provider, stock reservation and refunds.
	httpx.JSON(w, 201, map[string]any{
		"id": id, "amountTotal": total, "priceUnit": unit, "status": marketPaymentPending,
		"notice": "Payment not configured. No money collected, inventory reserved or seller order placed.",
	})
}
func (s *server) marketOrders(w http.ResponseWriter, r *http.Request) {
	before, limit, ok := marketPage(r)
	if !ok {
		httpx.Error(w, 400, "invalid pagination")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id,seller_id,amount_total,price_unit,status,created_at::text
 FROM market_orders WHERE buyer_id=$1 AND id<$2 ORDER BY id DESC LIMIT $3`, marketUser(r), before, limit)
	if err != nil {
		httpx.Error(w, 500, "unable to load orders")
		return
	}
	defer rows.Close()
	orders := make([]marketOrder, 0)
	for rows.Next() {
		var o marketOrder
		if rows.Scan(&o.ID, &o.SellerID, &o.AmountTotal, &o.PriceUnit, &o.Status, &o.CreatedAt) != nil {
			httpx.Error(w, 500, "unable to load orders")
			return
		}
		orders = append(orders, o)
	}
	if rows.Err() != nil {
		httpx.Error(w, 500, "unable to load orders")
		return
	}
	httpx.JSON(w, 200, map[string]any{"orders": orders})
}
