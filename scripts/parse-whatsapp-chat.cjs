#!/usr/bin/env node
/**
 * parse-whatsapp-chat.js
 *
 * Purpose:
 *   Converts an exported WhatsApp chat .txt file into a clean JSON file for
 *   The Seeker's Calendar web app.
 *
 * What it does:
 *   1. Reads WhatsApp exported chat text
 *   2. Correctly joins multiline messages
 *   3. Filters only messages from configured sender, default: "Samarpan"
 *   4. Keeps only messages that end with one of the allowed closing phrases
 *   5. Splits teaching text from closing phrase
 *   6. Writes public/data/messages.json
 *   7. Prints import summary and skipped counts
 *
 * Usage:
 *   node scripts/parse-whatsapp-chat.js ./exports/whatsapp-chat.txt ./public/data/messages.json
 *
 * Optional:
 *   node scripts/parse-whatsapp-chat.js ./chat.txt ./public/data/messages.json --sender="Samarpan"
 *
 * Supported WhatsApp date formats:
 *   18/09/2018, 07:11 - Samarpan: Message
 *   18/09/18, 07:11 - Samarpan: Message
 *   18/09/2018, 7:11 am - Samarpan: Message
 *   [18/09/2018, 07:11:00] Samarpan: Message
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = "./whatsapp-chat.txt";
const DEFAULT_OUTPUT = "./public/data/messages.json";
const DEFAULT_SENDER = "Samarpan";

const ALLOWED_CLOSINGS = [
  "Hari om.",
  "Satya sharnam.",
  "Guru sharnam.",
  "Hari sharnam."
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function parseCliArgs(argv) {
  const positional = [];
  const flags = {};

  argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [rawKey, ...rawValueParts] = arg.slice(2).split("=");
      const key = rawKey.trim();
      const value = rawValueParts.join("=").trim();
      flags[key] = value || true;
    } else {
      positional.push(arg);
    }
  });

  return {
    inputPath: positional[0] || DEFAULT_INPUT,
    outputPath: positional[1] || DEFAULT_OUTPUT,
    sender: flags.sender || DEFAULT_SENDER,
    pretty: flags.pretty !== "false"
  };
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeForComparison(value) {
  return String(value || "")
    .trim()
    .replace(/\u200e/g, "") // left-to-right mark sometimes appears in WhatsApp exports
    .replace(/\u200f/g, "") // right-to-left mark
    .replace(/\u0964/g, ".") // Devanagari danda । -> .
    .replace(/\u0965/g, ".") // double danda ॥ -> .
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeClosing(value) {
  return normalizeForComparison(value)
    .replace(/\s+\./g, ".")
    .replace(/\.+$/g, ".");
}

function canonicalClosingFromNormalized(normalizedClosing) {
  const match = ALLOWED_CLOSINGS.find(
    (closing) => normalizeClosing(closing) === normalizedClosing
  );
  return match || null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeToFourDigitYear(year) {
  if (year.length === 4) return Number(year);

  const twoDigitYear = Number(year);
  // WhatsApp exports with 2-digit years are uncommon but possible.
  // Treat 00-69 as 2000-2069 and 70-99 as 1970-1999.
  return twoDigitYear <= 69 ? 2000 + twoDigitYear : 1900 + twoDigitYear;
}

function parseTime(rawTime) {
  const value = rawTime.trim().toLowerCase();
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);

  if (!match) {
    return {
      time24: rawTime.trim(),
      hour: null,
      minute: null
    };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return {
    time24: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute
  };
}

function createDateParts(day, month, year, rawTime) {
  const yyyy = normalizeToFourDigitYear(year);
  const mm = Number(month);
  const dd = Number(day);
  const parsedTime = parseTime(rawTime);

  return {
    year: yyyy,
    month: mm,
    day: dd,
    time: parsedTime.time24,
    isoDate: `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    displayDate: `${dd} ${MONTH_NAMES[mm - 1]} ${yyyy}`
  };
}

function parseWhatsappExport(rawText) {
  const text = normalizeLineEndings(rawText);
  const lines = text.split("\n");
  const messages = [];
  let current = null;

  /**
   * Supported patterns:
   *   18/09/2018, 07:11 - Samarpan: Message
   *   18/09/18, 07:11 - Samarpan: Message
   *   18/09/2018, 7:11 am - Samarpan: Message
   *   [18/09/2018, 07:11] Samarpan: Message
   *   [18/09/2018, 07:11:00] Samarpan: Message
   */
  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)\s-\s([^:]+):\s?(.*)$/,
    /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)\]\s([^:]+):\s?(.*)$/
  ];

  function flushCurrent() {
    if (current) {
      current.message = current.messageLines.join("\n").trim();
      delete current.messageLines;
      messages.push(current);
    }
  }

  for (const line of lines) {
    let match = null;

    for (const pattern of patterns) {
      match = line.match(pattern);
      if (match) break;
    }

    if (match) {
      flushCurrent();

      const [, day, month, year, rawTime, sender, firstLine] = match;
      const dateParts = createDateParts(day, month, year, rawTime);

      current = {
        ...dateParts,
        sender: sender.trim(),
        messageLines: [firstLine || ""]
      };
    } else if (current) {
      current.messageLines.push(line);
    }
  }

  flushCurrent();
  return messages;
}

function findClosing(fullText) {
  const trimmed = String(fullText || "").trim();
  const normalizedFullText = normalizeForComparison(trimmed);

  for (const closing of ALLOWED_CLOSINGS) {
    const normalizedClosing = normalizeClosing(closing);
    const looseClosingWithoutPeriod = normalizedClosing.replace(/\.$/, "");

    if (
      normalizedFullText.endsWith(normalizedClosing) ||
      normalizedFullText.endsWith(looseClosingWithoutPeriod)
    ) {
      return closing;
    }
  }

  return null;
}

function splitTeachingAndClosing(fullText, canonicalClosing) {
  const original = String(fullText || "").trim();

  if (!canonicalClosing) {
    return {
      text: original,
      closing: "",
      fullText: original
    };
  }

  const variants = [
    canonicalClosing,
    canonicalClosing.replace(/\.$/, ""),
    canonicalClosing.replace(".", "।"),
    canonicalClosing.replace(/\.$/, "।")
  ];

  let cleanedText = original;
  let detectedClosingText = canonicalClosing;

  for (const variant of variants) {
    const pattern = new RegExp(`(?:\\s|\\n)*${escapeRegExp(variant)}\\s*$`, "i");
    if (pattern.test(cleanedText)) {
      const match = cleanedText.match(pattern);
      detectedClosingText = match ? match[0].trim() : canonicalClosing;
      cleanedText = cleanedText.replace(pattern, "").trim();
      break;
    }
  }

  return {
    text: cleanedText,
    closing: canonicalClosing,
    originalClosing: detectedClosingText,
    fullText: `${cleanedText}\n${canonicalClosing}`.trim()
  };
}

function inferLanguage(text) {
  // If Devanagari characters are present, mark as Hindi Devanagari.
  if (/[\u0900-\u097F]/.test(text)) return "hi-devanagari";

  // Your sample is Hindi/Sanskrit vocabulary in Latin script.
  return "hi-transliteration";
}

function toWisdomMessage(rawMessage, indexForSameTimestamp = 0) {
  const canonicalClosing = findClosing(rawMessage.message);
  const split = splitTeachingAndClosing(rawMessage.message, canonicalClosing);
  const compactTime = rawMessage.time.replace(":", "");
  const suffix = indexForSameTimestamp > 0 ? `-${indexForSameTimestamp + 1}` : "";

  return {
    id: `${rawMessage.isoDate}-${compactTime}${suffix}`,
    date: rawMessage.isoDate,
    displayDate: rawMessage.displayDate,
    year: rawMessage.year,
    month: rawMessage.month,
    day: rawMessage.day,
    sender: rawMessage.sender,
    time: rawMessage.time,
    text: split.text,
    closing: split.closing,
    originalClosing: split.originalClosing || split.closing,
    fullText: split.fullText,
    source: "whatsapp",
    tags: [],
    language: inferLanguage(split.text)
  };
}

function buildOutput(rawMessages, senderFilter) {
  const stats = {
    totalParsedMessages: rawMessages.length,
    accepted: 0,
    skippedDifferentSender: 0,
    skippedMissingAllowedClosing: 0,
    skippedEmptyTeaching: 0
  };

  const accepted = [];
  const idCounts = new Map();

  for (const rawMessage of rawMessages) {
    if (rawMessage.sender !== senderFilter) {
      stats.skippedDifferentSender += 1;
      continue;
    }

    const canonicalClosing = findClosing(rawMessage.message);
    if (!canonicalClosing) {
      stats.skippedMissingAllowedClosing += 1;
      continue;
    }

    const preview = splitTeachingAndClosing(rawMessage.message, canonicalClosing);
    if (!preview.text.trim()) {
      stats.skippedEmptyTeaching += 1;
      continue;
    }

    const baseId = `${rawMessage.isoDate}-${rawMessage.time.replace(":", "")}`;
    const duplicateCount = idCounts.get(baseId) || 0;
    idCounts.set(baseId, duplicateCount + 1);

    accepted.push(toWisdomMessage(rawMessage, duplicateCount));
    stats.accepted += 1;
  }

  accepted.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "whatsapp-export",
      sender: senderFilter,
      allowedClosings: ALLOWED_CLOSINGS,
      totalMessages: accepted.length,
      schemaVersion: 1
    },
    stats,
    messages: accepted
  };
}

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const { inputPath, outputPath, sender, pretty } = parseCliArgs(process.argv);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error("Usage: node scripts/parse-whatsapp-chat.js ./exports/chat.txt ./public/data/messages.json --sender=Samarpan");
    process.exit(1);
  }

  const rawText = fs.readFileSync(inputPath, "utf8");
  const parsedMessages = parseWhatsappExport(rawText);
  const output = buildOutput(parsedMessages, sender);

  ensureDirectoryExists(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, pretty ? 2 : 0), "utf8");

  console.log("WhatsApp chat parsing complete.");
  console.log("--------------------------------");
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Sender filter: ${sender}`);
  console.log(`Total parsed WhatsApp messages: ${output.stats.totalParsedMessages}`);
  console.log(`Accepted wisdom messages: ${output.stats.accepted}`);
  console.log(`Skipped - different sender: ${output.stats.skippedDifferentSender}`);
  console.log(`Skipped - missing allowed closing: ${output.stats.skippedMissingAllowedClosing}`);
  console.log(`Skipped - empty teaching: ${output.stats.skippedEmptyTeaching}`);
  console.log("--------------------------------");

  if (output.messages.length > 0) {
    const first = output.messages[0];
    const last = output.messages[output.messages.length - 1];
    console.log(`Date range: ${first.date} to ${last.date}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseWhatsappExport,
  buildOutput,
  findClosing,
  splitTeachingAndClosing,
  normalizeForComparison
};
