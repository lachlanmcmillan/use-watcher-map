import { beforeAll, afterAll } from 'bun:test';
import { JSDOM } from 'jsdom';

// Set up a fake DOM environment for testing
beforeAll(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  // Make DOM elements global
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.getComputedStyle = dom.window.getComputedStyle;
});

// Clean up after all tests
afterAll(() => {
  // @ts-ignore
  delete global.window;
  // @ts-ignore
  delete global.document;
  // @ts-ignore
  delete global.navigator;
  // @ts-ignore
  delete global.getComputedStyle;
});
