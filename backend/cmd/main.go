package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	// Create Gin router
	r := gin.Default()

	// Add CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"message": "OYAH Backend is running",
		})
	})

	// API v1 routes group
	v1 := r.Group("/api/v1")
	{
		// Placeholder routes - will be implemented in later tasks
		v1.POST("/submitResult", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Submit result endpoint - to be implemented"})
		})
		
		v1.GET("/getTally/:votingProcessId", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Get tally endpoint - to be implemented"})
		})
	}

	log.Println("Starting OYAH Backend server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}