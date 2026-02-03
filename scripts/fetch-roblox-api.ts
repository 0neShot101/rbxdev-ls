/**
 * Roblox API Dump Fetcher
 * Downloads the Full-API-Dump.json from Roblox Client Tracker
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const API_URL = 'https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/roblox/Full-API-Dump.json';
const OUTPUT_PATH = join(__dirname, '..', 'data', 'roblox-api.json');

const fetchRobloxApi = async (): Promise<void> => {
  console.log('Fetching Roblox API dump...');
  console.log(`URL: ${API_URL}`);

  const response = await fetch(API_URL);

  if (response.ok === false) {
    throw new Error(`Failed to fetch API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Ensure data directory exists
  const dataDir = dirname(OUTPUT_PATH);
  if (existsSync(dataDir) === false) {
    mkdirSync(dataDir, { 'recursive': true });
  }

  // Write the API dump
  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));

  // Log statistics
  const classes = data.Classes?.length ?? 0;
  const enums = data.Enums?.length ?? 0;

  console.log(`Successfully fetched Roblox API:`);
  console.log(`  Classes: ${classes}`);
  console.log(`  Enums: ${enums}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
};

fetchRobloxApi().catch(err => {
  console.error('Error fetching Roblox API:', err);
  process.exit(1);
});
