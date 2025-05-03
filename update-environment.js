#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Derive __dirname when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse a range string like "-10..20" into [min, max]
function parseRange(rangeStr) {
  const [minStr, maxStr] = rangeStr.split('..');
  return [Number(minStr), Number(maxStr)];
}

// Add two range strings and return a new range string
function addRanges(rangeA, rangeB) {
  const [minA, maxA] = parseRange(rangeA);
  const [minB, maxB] = parseRange(rangeB);
  return `${minA + minB}..${maxA + maxB}`;
}

// Process a single JSON file
async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    console.error(`Skipping invalid JSON: ${filePath}`);
    return;
  }

  if (!Array.isArray(data.choices)) return;
  let changed = false;

  data.choices.forEach(choice => {
    const env = choice.effects && choice.effects.environment;
    if (env) {
      // Compute new keys
      const social = addRanges(env.stability, env.labor_shock);
      const cyberBio = addRanges(env.cyber_risk, env.bio_risk);
      const climate = env.climate_load;

      // Replace environment object
      choice.effects.environment = {
        social_stability: social,
        cyber_bio_risk: cyberBio,
        climate_load: climate
      };
      changed = true;
    }
  });

  if (changed) {
    // Write back formatted JSON
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

// Recursively walk a directory
async function processDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      await processFile(fullPath);
    }
  }
}

// Main entry
async function main() {
  const eventsDir = path.join(__dirname, 'src/lib/content/events');
  await processDir(eventsDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 