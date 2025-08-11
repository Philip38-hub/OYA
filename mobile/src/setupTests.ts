// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock window.injectedWeb3 for Polkadot extension testing
Object.defineProperty(window, 'injectedWeb3', {
  value: {},
  writable: true,
});

// Mock WebSocket for API connections
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
})) as any;

// Add TextEncoder and TextDecoder polyfills for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;