package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// LoggingMiddleware creates a Gin middleware for structured logging
func LoggingMiddleware(logger *logrus.Logger) gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Create structured log entry
		logger.WithFields(logrus.Fields{
			"timestamp":    param.TimeStamp.Format(time.RFC3339),
			"status_code":  param.StatusCode,
			"latency":      param.Latency,
			"client_ip":    param.ClientIP,
			"method":       param.Method,
			"path":         param.Path,
			"user_agent":   param.Request.UserAgent(),
			"error":        param.ErrorMessage,
		}).Info("HTTP Request")

		// Return empty string since we're using structured logging
		return ""
	})
}

// RequestTracingMiddleware adds request tracing headers
func RequestTracingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Add request start time
		c.Set("request_start", time.Now())
		
		// Add response headers for tracing
		c.Header("X-Request-ID", c.GetString("request_id"))
		c.Header("X-Response-Time", "")
		
		c.Next()
		
		// Calculate and set response time
		if startTime, exists := c.Get("request_start"); exists {
			duration := time.Since(startTime.(time.Time))
			c.Header("X-Response-Time", duration.String())
		}
	}
}