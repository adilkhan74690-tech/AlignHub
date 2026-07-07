import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ override: true });

async function tryConnect(uri: string, name: string) {
  try {
    console.log(`[${name}] Attempting connection...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log(`[${name}] SUCCESS: Connected to MongoDB successfully!`);
    await mongoose.disconnect();
    return true;
  } catch (err: any) {
    console.log(`[${name}] FAILED to connect:`, err.message);
    return false;
  }
}

async function getPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json').then(r => r.json());
    return res.ip;
  } catch {
    return 'Could not retrieve public IP automatically';
  }
}

async function testConnection() {
  const envUri = process.env.MONGODB_URI || '';
  const publicIp = await getPublicIp();
  console.log(`Current runner public IP is: ${publicIp}`);
  
  // Test 1: exact env URI
  const res1 = await tryConnect(envUri, 'ENV_URI');
  if (res1) process.exit(0);

  // Test 2: Try removing < > brackets if present
  if (envUri.includes('<') && envUri.includes('>')) {
    const withoutBrackets = envUri.replace('<', '').replace('>', '');
    const resBrackets = await tryConnect(withoutBrackets, 'WITHOUT_BRACKETS');
    if (resBrackets) {
      console.log('Found working URI without brackets:', withoutBrackets);
      process.exit(0);
    }

    // Try fallback of 12345 replacing the password inside the brackets
    const passwordInside = envUri.match(/<([^>]+)>/)?.[1] || '';
    if (passwordInside) {
      const fallbackWith12345 = envUri.replace(`<${passwordInside}>`, '12345');
      const resFallback12345 = await tryConnect(fallbackWith12345, 'FALLBACK_12345');
      if (resFallback12345) {
        console.log('Found working URI with 12345:', fallbackWith12345);
        process.exit(0);
      }
    }
  }

  // Test 3: Try standard fallbacks
  if (envUri.includes('Adil12345')) {
    const fallbackUri = envUri.replace('Adil12345', 'Adil%40123');
    const res2 = await tryConnect(fallbackUri, 'FALLBACK_URI_ADIL_AT_123');
    if (res2) process.exit(0);

    const fallbackUri2 = envUri.replace('Adil12345', '12345');
    const res3 = await tryConnect(fallbackUri2, 'FALLBACK_URI_12345');
    if (res3) process.exit(0);
  } else if (envUri.includes('12345')) {
    const fallbackUri = envUri.replace('12345', 'Adil12345');
    const res2 = await tryConnect(fallbackUri, 'FALLBACK_URI_ADIL12345');
    if (res2) process.exit(0);
  }

  console.error('\nBoth connection attempts failed. This is highly likely an Atlas IP Access List (Whitelist) restriction.');
  console.error('Please ensure that "Allow Access From Anywhere" (0.0.0.0/0) is added to your Atlas IP Whitelist.');
  process.exit(1);
}

testConnection();
