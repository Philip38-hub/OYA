import * as Location from 'expo-location';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationPermissions {
  foreground: boolean;
  background: boolean;
}

export interface LocationResult {
  coordinates: GPSCoordinates;
  timestamp: number;
  accuracy: number;
}

export class LocationService {
  private static readonly HIGH_ACCURACY_TIMEOUT = 15000; // 15 seconds
  private static readonly LOW_ACCURACY_TIMEOUT = 30000; // 30 seconds
  private static readonly MIN_ACCURACY_METERS = 100; // 100 meters

  static async requestPermissions(): Promise<LocationPermissions> {
    try {
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      
      return {
        foreground: foregroundPermission.status === 'granted',
        background: false, // We don't need background location for this app
      };
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return {
        foreground: false,
        background: false,
      };
    }
  }

  static async checkPermissions(): Promise<LocationPermissions> {
    try {
      const foregroundPermission = await Location.getForegroundPermissionsAsync();
      
      return {
        foreground: foregroundPermission.status === 'granted',
        background: false,
      };
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return {
        foreground: false,
        background: false,
      };
    }
  }

  static async getCurrentLocation(): Promise<LocationResult> {
    try {
      // Check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        throw new Error('Location services are disabled');
      }

      // Check permissions
      const permissions = await this.checkPermissions();
      if (!permissions.foreground) {
        throw new Error('Location permission not granted');
      }

      // Try to get high accuracy location first
      let location: Location.LocationObject;
      
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        });
      } catch (highAccuracyError) {
        console.warn('High accuracy location failed, trying balanced accuracy:', highAccuracyError);
        
        // Fallback to balanced accuracy
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 10,
        });
      }

      const result: LocationResult = {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
          altitude: location.coords.altitude || undefined,
          heading: location.coords.heading || undefined,
          speed: location.coords.speed || undefined,
        },
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy || 0,
      };

      // Validate accuracy
      if (!this.isLocationAccurate(result)) {
        console.warn('Location accuracy is poor:', result.accuracy);
      }

      return result;
    } catch (error) {
      console.error('Error getting current location:', error);
      throw new Error(`Failed to get location: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getLocationWithRetry(maxRetries: number = 3): Promise<LocationResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const location = await this.getCurrentLocation();
        
        // If we get a good accuracy location, return it
        if (this.isLocationAccurate(location)) {
          return location;
        }
        
        // If accuracy is poor but it's our last attempt, return it anyway
        if (attempt === maxRetries) {
          console.warn('Returning location with poor accuracy after all retries');
          return location;
        }
        
        // Wait before retry
        await this.delay(1000 * attempt);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Location attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          await this.delay(1000 * attempt);
        }
      }
    }
    
    throw lastError || new Error('Failed to get location after all retries');
  }

  static isLocationAccurate(location: LocationResult): boolean {
    return location.accuracy <= this.MIN_ACCURACY_METERS;
  }

  static validateCoordinates(coordinates: GPSCoordinates): boolean {
    const { latitude, longitude } = coordinates;
    
    // Check if coordinates are within valid ranges
    if (latitude < -90 || latitude > 90) {
      return false;
    }
    
    if (longitude < -180 || longitude > 180) {
      return false;
    }
    
    // Check if coordinates are not null island (0, 0)
    if (latitude === 0 && longitude === 0) {
      return false;
    }
    
    return true;
  }

  static formatCoordinatesForDisplay(coordinates: GPSCoordinates): string {
    const lat = coordinates.latitude.toFixed(6);
    const lng = coordinates.longitude.toFixed(6);
    const accuracy = coordinates.accuracy ? ` (±${coordinates.accuracy.toFixed(0)}m)` : '';
    
    return `${lat}, ${lng}${accuracy}`;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}