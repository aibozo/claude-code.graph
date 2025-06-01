// Jest setup file
// Runs before all tests

import { jest } from '@jest/globals';

// Set test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to silence logs during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Clean up environment variables
delete process.env.DEBUG;

// Global test utilities
global.testUtils = {
  // Add common test utilities here
};