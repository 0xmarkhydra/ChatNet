FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
ARG SERVICE
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/service ./cmd/${SERVICE}

FROM alpine:3.20
RUN adduser -D -H app
USER app
COPY --from=build /out/service /service
EXPOSE 8080
ENTRYPOINT ["/service"]
