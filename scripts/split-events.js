#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsPath = path.resolve(__dirname, '../src/lib/content/events.json');
const outDir = path.resolve(__dirname, '../src/lib/content/events');

function main() {
  const data = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
  const groups = data.reduce((acc, event) => {
    const { year, quarter } = event;
    acc[year] = acc[year] || {};
    acc[year][quarter] = acc[year][quarter] || [];
    acc[year][quarter].push(event);
    return acc;
  }, {});

  Object.entries(groups).forEach(([year, quarters]) => {
    Object.entries(quarters).forEach(([quarter, events]) => {
      const dir = path.join(outDir, year.toString(), `Q${quarter}`);
      fs.mkdirSync(dir, { recursive: true });
      events.forEach((event) => {
        const fileName = `${event.id}.json`;
        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(event, null, 2) + '\n');
        console.log(`Wrote ${filePath}`);
      });
    });
  });
}

main(); 