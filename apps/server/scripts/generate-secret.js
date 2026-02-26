#!/usr/bin/env node

/**
 * Generate a secure random JWT secret
 * Usage: node scripts/generate-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔐 Generated secure JWT secret:\n');
console.log(secret);
console.log('\n📝 Add this to your .env file:');
console.log(`JWT_SECRET="${secret}"`);
console.log('\n⚠️  Keep this secret safe and never commit it to version control!\n');
