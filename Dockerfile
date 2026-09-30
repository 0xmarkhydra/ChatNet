FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

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
