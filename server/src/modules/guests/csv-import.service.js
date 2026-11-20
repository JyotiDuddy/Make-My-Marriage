const { parse } = require('csv-parse/sync');
const ApiError = require('../../shared/errors/api-error');
const { normalizeMobile, validateGuestInput } = require('./guest.validation');

const CSV_COLUMNS = ['familyName', 'primaryContactName', 'mobile', 'email', 'familyGroupInfo', 'notes'];
const REQUIRED_COLUMNS = ['familyName', 'mobile'];
const MAX_CSV_ROWS = 500;

function csvError(message) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function parseGuestCsv(file) {
  if (!file?.buffer?.length) throw csvError('A non-empty CSV file is required.');
  if (!file.originalname?.toLowerCase().endsWith('.csv')) throw csvError('The uploaded file must have a .csv extension.');
  if (file.buffer.includes(0) || file.buffer.toString('utf8').includes('\uFFFD')) throw csvError('The uploaded file must contain valid UTF-8 CSV text.');

  let parsed;
  try {
    parsed = parse(file.buffer, { bom: true, skip_empty_lines: true, trim: true, relax_column_count: true, info: true });
  } catch {
    throw csvError('The uploaded file is not valid CSV.');
  }
  if (!parsed.length) throw csvError('The uploaded CSV is empty.');

  const headerRecord = parsed[0].record;
  const headers = headerRecord.map((value) => String(value).trim());
  if (new Set(headers).size !== headers.length) throw csvError('The CSV contains duplicate column headers.');
  if (headers.some((header) => !CSV_COLUMNS.includes(header))) throw csvError('The CSV contains an unsupported column.');
  if (REQUIRED_COLUMNS.some((header) => !headers.includes(header))) {
    throw csvError('The CSV must include the required familyName and mobile headers.');
  }

  const rows = parsed.slice(1);
  if (rows.length > MAX_CSV_ROWS) throw csvError('A CSV import may contain no more than 500 data rows.');
  return rows.map(({ record, info }) => ({
    rowNumber: info.lines,
    fields: Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])),
    malformed: record.length !== headers.length,
  }));
}

function validateCsvRow(row) {
  if (row.malformed) throw new Error('The number of fields does not match the CSV header.');
  const input = { ...row.fields, invitedEvents: [] };
  const fields = validateGuestInput(input);
  return { ...fields, mobile: normalizeMobile(fields.mobile), invitedEvents: [] };
}

function createCsvImportService({ GuestModel } = {}) {
  async function importGuests(user, file, wedding) {
    const rows = parseGuestCsv(file);
    const existingGuests = await GuestModel.find({ weddingId: wedding._id, deletedAt: { $exists: false } }).select('mobile');
    const knownMobiles = new Set(existingGuests.map(({ mobile }) => mobile));
    const summary = { totalRows: rows.length, importedCount: 0, skippedCount: 0, errors: [], warnings: [] };

    for (const row of rows) {
      let fields;
      try {
        fields = validateCsvRow(row);
      } catch (error) {
        summary.skippedCount += 1;
        summary.errors.push({ rowNumber: row.rowNumber, reason: error.message });
        continue;
      }

      if (knownMobiles.has(fields.mobile)) {
        summary.warnings.push({
          rowNumber: row.rowNumber,
          reason: 'A family with this normalized mobile number already exists or appears elsewhere in this import.',
        });
      }

      await GuestModel.create({ ...fields, weddingId: wedding._id, createdBy: user._id });
      knownMobiles.add(fields.mobile);
      summary.importedCount += 1;
    }
    return summary;
  }

  return { importGuests };
}

module.exports = { CSV_COLUMNS, REQUIRED_COLUMNS, MAX_CSV_ROWS, parseGuestCsv, validateCsvRow, createCsvImportService };
