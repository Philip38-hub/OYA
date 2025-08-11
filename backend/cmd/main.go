package main

import (
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"

	"oyah-backend/internal/handlers"
	"oyah-backend/internal/middleware"
	"oyah-backend/internal/services"
)

func main() {
	// Initialize structured logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	logger.SetLevel(logrus.InfoLevel)
	
	// Set log output to stdout for containerized environments
	logger.SetOutput(os.Stdout)

	logger.Info("Starting OYAH Backend server initialization")

	// Initialize services
	storageService := services.NewStorageService()
	validationService := services.NewValidationService(storageService)
	consensusService := services.NewConsensusService(storageService, logger)

	// Initialize handlers
	submissionHandler := handlers.NewSubmissionHandler(storageService, validationService, consensusService, logger)
	votingProcessHandler := handlers.NewVotingProcessHandler(storageService, logger)

	// Create Gin router
	r := gin.New()

	// Add structured logging middleware
	r.Use(middleware.LoggingMiddleware(logger))
	r.Use(middleware.RequestTracingMiddleware())
	r.Use(gin.Recovery())

	// Configure CORS for mobile app communication
	corsConfig := cors.Config{
		AllowOrigins:     []string{"*"}, // In production, specify exact origins
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"X-Request-ID", "X-Response-Time"},
		AllowCredentials: false,
		MaxAge:           12 * 3600, // 12 hours
	}
	r.Use(cors.New(corsConfig))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"message":   "OYAH Backend is running",
			"timestamp": "2025-01-08T00:00:00Z", // Will be dynamic in production
		})
	})

	// API v1 routes group
	v1 := r.Group("/api/v1")
	{
		// Submission endpoints
		v1.POST("/submitResult", submissionHandler.SubmitResult)
		
		// Voting process management endpoints
		v1.POST("/voting-process", votingProcessHandler.CreateVotingProcess)
		v1.PUT("/voting-process/:id/start", votingProcessHandler.StartVotingProcess)
		v1.GET("/voting-process/:id", votingProcessHandler.GetVotingProcess)
		
		// Placeholder for future endpoints
		v1.GET("/getTally/:votingProcessId", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Get tally endpoint - to be implemented"})
		})
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.WithField("port", port).Info("Starting OYAH Backend server")
	if err := r.Run(":" + port); err != nil {
		logger.WithError(err).Fatal("Failed to start server")
	}
}