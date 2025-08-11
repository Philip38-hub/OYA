import { LocationService, GPSCoordinates, LocationResult } from '../locationService';
import * as Location from 'expo-location';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: {
    High: 1,
    Balanced: 3,
  },
}));

const mockLocation = Location as jest.Mocked<typeof Location>;

const createMockPermissionResponse = (granted: boolean) => ({
  status: granted ? 'granted' : 'denied',
  granted,
  canAskAgain: !granted,
  expires: 'never',
});

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return true when permission is granted', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(true) as any
      );

      const result = await LocationService.requestPermissions();

      expect(result).toEqual({
        foreground: true,
        background: false,
      });
    });

    it('should return false when permission is denied', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(false) as any
      );

      const result = await LocationService.requestPermissions();

      expect(result).toEqual({
        foreground: false,
        background: false,
      });
    });

    it('should handle errors gracefully', async () => {
      mockLocation.requestForegroundPermissionsAsync.mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await LocationService.requestPermissions();

      expect(result).toEqual({
        foreground: false,
        background: false,
      });
    });
  });

  describe('checkPermissions', () => {
    it('should return current permission status', async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(true) as any
      );

      const result = await LocationService.checkPermissions();

      expect(result).toEqual({
        foreground: true,
        background: false,
      });
    });
  });

  describe('getCurrentLocation', () => {
    const mockLocationData = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        altitude: 100,
        altitudeAccuracy: 5,
        heading: 90,
        speed: 5,
      },
      timestamp: Date.now(),
    };

    beforeEach(() => {
      mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(true) as any
      );
    });

    it('should return location data successfully', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue(mockLocationData);

      const result = await LocationService.getCurrentLocation();

      expect(result).toEqual({
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          altitude: 100,
          heading: 90,
          speed: 5,
        },
        timestamp: mockLocationData.timestamp,
        accuracy: 10,
      });
    });

    it('should fallback to balanced accuracy when high accuracy fails', async () => {
      mockLocation.getCurrentPositionAsync
        .mockRejectedValueOnce(new Error('High accuracy failed'))
        .mockResolvedValueOnce(mockLocationData);

      const result = await LocationService.getCurrentLocation();

      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
      expect(result.coordinates.latitude).toBe(40.7128);
    });

    it('should throw error when location services are disabled', async () => {
      mockLocation.hasServicesEnabledAsync.mockResolvedValue(false);

      await expect(LocationService.getCurrentLocation()).rejects.toThrow(
        'Location services are disabled'
      );
    });

    it('should throw error when permission is not granted', async () => {
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(false) as any
      );

      await expect(LocationService.getCurrentLocation()).rejects.toThrow(
        'Location permission not granted'
      );
    });
  });

  describe('getLocationWithRetry', () => {
    const accurateLocationData = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 50,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    const inaccurateLocationData = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 200,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };

    beforeEach(() => {
      mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
      mockLocation.getForegroundPermissionsAsync.mockResolvedValue(
        createMockPermissionResponse(true) as any
      );
    });

    it('should return immediately when location is accurate', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue(accurateLocationData);

      const result = await LocationService.getLocationWithRetry(3);

      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
      expect(result.accuracy).toBe(50);
    });

    it('should retry when location is inaccurate', async () => {
      mockLocation.getCurrentPositionAsync
        .mockResolvedValueOnce(inaccurateLocationData)
        .mockResolvedValueOnce(accurateLocationData);

      const result = await LocationService.getLocationWithRetry(3);

      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
      expect(result.accuracy).toBe(50);
    });

    it('should return inaccurate location after all retries', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue(inaccurateLocationData);

      const result = await LocationService.getLocationWithRetry(2);

      expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
      expect(result.accuracy).toBe(200);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      const validCoords: GPSCoordinates = {
        latitude: 40.7128,
        longitude: -74.0060,
      };

      expect(LocationService.validateCoordinates(validCoords)).toBe(true);
    });

    it('should reject coordinates outside valid ranges', () => {
      const invalidLat: GPSCoordinates = {
        latitude: 91,
        longitude: -74.0060,
      };

      const invalidLng: GPSCoordinates = {
        latitude: 40.7128,
        longitude: 181,
      };

      expect(LocationService.validateCoordinates(invalidLat)).toBe(false);
      expect(LocationService.validateCoordinates(invalidLng)).toBe(false);
    });

    it('should reject null island coordinates', () => {
      const nullIsland: GPSCoordinates = {
        latitude: 0,
        longitude: 0,
      };

      expect(LocationService.validateCoordinates(nullIsland)).toBe(false);
    });
  });

  describe('isLocationAccurate', () => {
    it('should return true for accurate location', () => {
      const accurateLocation: LocationResult = {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: Date.now(),
        accuracy: 50,
      };

      expect(LocationService.isLocationAccurate(accurateLocation)).toBe(true);
    });

    it('should return false for inaccurate location', () => {
      const inaccurateLocation: LocationResult = {
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        timestamp: Date.now(),
        accuracy: 200,
      };

      expect(LocationService.isLocationAccurate(inaccurateLocation)).toBe(false);
    });
  });

  describe('formatCoordinatesForDisplay', () => {
    it('should format coordinates with accuracy', () => {
      const coords: GPSCoordinates = {
        latitude: 40.712800,
        longitude: -74.006000,
        accuracy: 25,
      };

      const result = LocationService.formatCoordinatesForDisplay(coords);

      expect(result).toBe('40.712800, -74.006000 (±25m)');
    });

    it('should format coordinates without accuracy', () => {
      const coords: GPSCoordinates = {
        latitude: 40.712800,
        longitude: -74.006000,
      };

      const result = LocationService.formatCoordinatesForDisplay(coords);

      expect(result).toBe('40.712800, -74.006000');
    });
  });
});