.PHONY: up down reset logs build test frontend

up:
	docker compose up --build

down:
	docker compose down

reset:
	docker compose down -v
	docker compose up --build

logs:
	docker compose logs -f --tail=200

build:
	docker compose build

test:
	cd backend && go test ./...
	cd frontend && npm run build

frontend:
	cd frontend && npm run dev
