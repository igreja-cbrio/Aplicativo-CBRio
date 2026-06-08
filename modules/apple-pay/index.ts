// Re-export the native module. On web, it will be resolved to ApplePayModule.web.ts
// and on native platforms to ApplePayModule.ts
export { default } from './src/ApplePayModule';
export * from './src/ApplePay.types';
