// Fast drop-in replacement for csv-reader 1.0.0's readCsv (make.fun csv-reader-speed-01).
//
// Returns exactly the same {columns, rows, errors} as the reference for every input, but scans
// with indexOf hops and slice-based field extraction instead of one character at a time.
// Pure: all state lives inside run(), nothing is kept between calls.

const COMMA = 1;
const LINE_BREAK = 2;
const END = 3;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1; // one leading BOM is dropped

  // Index of the first CR at or after the last place it was refreshed for, or -1 when the rest
  // of the text holds none. Lets the fast paths decide "no CR inside this range" in O(1)
  // instead of scanning the range; refreshed lazily whenever pos has moved past it.
  let crIdx = text.indexOf('\r');

  // The record being read: the line it starts on and its index in rows (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read, set by readUnquoted / readQuoted.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0; // characters readUnquoted kept (drives the quote_junk check)

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  function finishField(prefix, parts, seg, end) {
    if (parts === null) return prefix + text.slice(seg, end);
    parts.push(text.slice(seg, end));
    return prefix + parts.join('');
  }

  // Char-by-char path for an unquoted field that contains a stray CR: a CR not followed by LF
  // is dropped (stray_cr). Everything else follows the same rules as the fast path.
  function readUnquotedSlow(prefix) {
    let parts = null;
    let seg = pos;
    let i = pos;
    let added = 0;
    while (i < len) {
      const cc = text.charCodeAt(i);
      if (cc === 44) { // ','
        added += i - seg;
        fValue = finishField(prefix, parts, seg, i);
        fAdded = added;
        pos = i + 1;
        fEnded = COMMA;
        return;
      }
      if (cc === 10) { // '\n'
        added += i - seg;
        fValue = finishField(prefix, parts, seg, i);
        fAdded = added;
        pos = i + 1;
        line += 1;
        fEnded = LINE_BREAK;
        return;
      }
      if (cc === 13) { // '\r'
        if (text.charCodeAt(i + 1) === 10) { // CRLF
          added += i - seg;
          fValue = finishField(prefix, parts, seg, i);
          fAdded = added;
          pos = i + 2;
          line += 1;
          fEnded = LINE_BREAK;
          return;
        }
        pushError('stray_cr');
        if (parts === null) parts = [];
        parts.push(text.slice(seg, i));
        added += i - seg;
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    added += len - seg;
    fValue = finishField(prefix, parts, seg, len);
    fAdded = added;
    pos = len;
    fEnded = END;
  }

  // Reads unquoted characters onto `prefix` up to the next comma or line break.
  function readUnquoted(prefix) {
    const start = pos;
    const ci = text.indexOf(',', start);
    const ni = text.indexOf('\n', start);
    let j;
    let ended;
    if (ci === -1 && ni === -1) {
      j = len;
      ended = END;
    } else if (ni === -1 || (ci !== -1 && ci < ni)) {
      j = ci;
      ended = COMMA;
    } else {
      j = ni;
      ended = LINE_BREAK;
    }
    let end = j;
    // A LF whose previous character is CR is a CRLF break: the CR is part of the break.
    if (ended === LINE_BREAK && j > start && text.charCodeAt(j - 1) === 13) end = j - 1;
    if (crIdx !== -1 && crIdx < start) crIdx = text.indexOf('\r', start);
    if (crIdx !== -1 && crIdx < end) {
      // A CR inside the field (not the CRLF of the break): it may be a stray CR. Slow path.
      readUnquotedSlow(prefix);
      return;
    }
    if (end > start) {
      fValue = prefix + text.slice(start, end);
      fAdded = end - start;
    } else {
      fValue = prefix;
      fAdded = 0;
    }
    if (ended === COMMA) {
      pos = j + 1;
    } else if (ended === LINE_BREAK) {
      pos = j + 1;
      line += 1;
    } else {
      pos = len;
    }
    fEnded = ended;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let segStart = open + 1;
    let i = segStart;
    let parts = null; // null while the content so far is the raw text[open+1 .. here)
    while (true) {
      const j = text.indexOf('"', i);
      if (j === -1) {
        // The quote never closes: it is a literal character, and the text after it is read
        // again as an unquoted field. pos moves backwards here, so the CR cache (which only
        // ever looks forward) must be rebuilt for the re-read.
        pos = open + 1;
        line = openLine;
        crIdx = text.indexOf('\r', pos);
        pushError('unterminated_quote');
        readUnquoted('"');
        return;
      }
      // The raw segment [segStart, j): count its line breaks; CRs are read as LF.
      if (j > segStart) {
        if (crIdx !== -1 && crIdx < segStart) crIdx = text.indexOf('\r', segStart);
        if (crIdx !== -1 && crIdx < j) {
          if (parts === null) parts = [text.slice(open + 1, segStart)];
          const norm = text.slice(segStart, j).replace(/\r\n|\r/g, '\n');
          let cnt = 0;
          let p = -1;
          while ((p = norm.indexOf('\n', p + 1)) !== -1) cnt += 1;
          line += cnt;
          parts.push(norm);
          crIdx = text.indexOf('\r', j);
        } else {
          let p = segStart;
          while ((p = text.indexOf('\n', p)) !== -1 && p < j) {
            line += 1;
            p += 1;
          }
          if (parts !== null) parts.push(text.slice(segStart, j));
        }
      }
      if (text.charCodeAt(j + 1) === 34) {
        // A doubled quote: one literal quote in the value.
        if (parts === null) parts = [text.slice(open + 1, j)];
        parts.push('"');
        segStart = j + 2;
        i = j + 2;
        continue;
      }
      // The closing quote.
      const value = parts === null ? text.slice(open + 1, j) : parts.join('');
      pos = j + 1;
      if (pos >= len) {
        fValue = value;
        fEnded = END;
        return;
      }
      const c = text[pos];
      if (c === ',') {
        pos += 1;
        fValue = value;
        fEnded = COMMA;
        return;
      }
      if (c === '\n') {
        pos += 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        return;
      }
      if (c === '\r' && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        return;
      }
      // What follows the closing quote is appended as it stands, up to the next comma or
      // line break (quote_junk when anything was actually appended).
      readUnquoted(value);
      if (fAdded > 0) pushError('quote_junk');
      return;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      if (text[pos] === '\n') {
        pos += 1;
        line += 1;
      } else if (text[pos] === '\r' && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text[pos] === '"';
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
