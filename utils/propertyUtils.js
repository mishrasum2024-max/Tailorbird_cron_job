import fs from 'fs';
import path from 'path';

export function getPropertyName() {
  const paths = [
    path.join(process.cwd(), 'downloads', 'property.json'),
    path.join(process.cwd(), 'data', 'propertyData.json')
  ];

  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(rawData);
        if (data?.propertyName) return data.propertyName;
      }
    } catch (_) {
      // Try next path
    }
  }

  throw new Error('Property name not found. Ensure TC14 (create property) runs first or property.json exists in downloads/ or data/');
}

export function getPropertyNameFromDownload() {
  const filePath = path.join(process.cwd(), 'downloads', 'property.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('downloads/property.json not found. Ensure TC14 (create property) runs first.');
  }
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(rawData);
  if (!data?.propertyName) {
    throw new Error('propertyName not found in downloads/property.json');
  }
  return data.propertyName;
}
