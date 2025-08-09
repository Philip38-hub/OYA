.PHONY: run build test clean dev

# Development server with hot reload
dev:
	go run cmd/main.go

# Build the application
build:
	go build -o bin/oyah-backend cmd/main.go

# Run the built application
run: build
	./bin/oyah-backend

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -rf bin/

# Install dependencies
deps:
	go mod download
	go mod tidy

# Format code
fmt:
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Run with live reload (requires air)
watch:
	air