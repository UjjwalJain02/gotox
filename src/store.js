'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'links.json');

const CODE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** @type {Map<string, { url: string, clicks: number, createdAt: string }>} */
let links = new Map();

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '{}', 'utf8');
  }
}

function load() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  let parsed = {};
  try {
    parsed = JSON.parse(raw || '{}');
  } catch (err) {
    parsed = {};
  }
  links = new Map(Object.entries(parsed));
}

function persist() {
  const obj = Object.fromEntries(links);
  fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8', (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist links.json:', err);
    }
  });
}

function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function createLink(url) {
  let code = generateCode();
  let attempts = 0;
  while (links.has(code) && attempts < 10) {
    code = generateCode();
    attempts += 1;
  }
  const entry = { url, clicks: 0, createdAt: new Date().toISOString() };
  links.set(code, entry);
  persist();
  return code;
}

function getLink(code) {
  return links.get(code) || null;
}

function incrementClicks(code) {
  const entry = links.get(code);
  if (!entry) return;
  entry.clicks += 1;
  persist();
}

load();

module.exports = { createLink, getLink, incrementClicks };
