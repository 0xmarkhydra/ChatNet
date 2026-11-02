FROM node:24-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY backend/cmd/call/translation.go /src/backend/cmd/call/translation.go
COPY backend/cmd/call/main.go /src/backend/cmd/call/main.go
RUN npm run build \
    && npm run check:pwa \
    && npm run check:session \
    && npm run check:incoming-sound \
    && npm run check:onesignal \
    && npm run check:call-live

FROM golang:1.23-alpine AS gateway-build
WORKDIR /src/backend
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/gateway ./cmd/gateway

FROM alpine:3.20
RUN adduser -D -H app
WORKDIR /app
COPY --from=gateway-build /out/gateway /app/gateway
COPY --from=frontend-build /src/frontend/dist /app/public
ENV STATIC_DIR=/app/public
ENV PORT=8080
USER app
EXPOSE 8080
ENTRYPOINT ["/app/gateway"]
