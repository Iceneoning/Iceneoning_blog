import { constants } from 'node:fs';
import { access, lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'));
const roots = ['public', 'src'].map((name) => path.join(root, name));
const protectedFile = path.join(root, 'public/background/mobile-background.jpg');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tif', '.tiff']);
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const inside = (base, file) => {
  const rel = path.relative(base, file);
  return rel !== '' && !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`);
};

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function checkedFile(input) {
  const file = path.resolve(root, input);
  if (!roots.some((base) => inside(base, file))) throw new Error('Input must be inside public/ or src/.');
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Input must be a regular file.');
  const resolved = await realpath(file);
  if (resolved !== file) throw new Error('Paths through symbolic links are not supported.');
  return { file, stat };
}

async function scan(directory, rows) {
  if (!(await exists(directory))) return;
  if ((await lstat(directory)).isSymbolicLink()) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await scan(file, rows);
    } else if (entry.isFile() && imageExtensions.has(path.extname(file).toLowerCase())) {
      try {
        await checkedFile(file);
        const input = await readFile(file);
        const meta = await sharp(input).metadata();
        rows.push({ file: relative(file), bytes: input.length, format: meta.format,
          width: meta.width, height: meta.height, alpha: Boolean(meta.hasAlpha),
          pages: meta.pages ?? 1, orientation: meta.orientation ?? 1,
          protected: file === protectedFile || inside(path.join(root, 'public/favicon'), file) });
      } catch (error) {
        rows.push({ file: relative(file), error: error.message });
        process.exitCode = 1;
      }
    }
  }
}

function percentage(value, label) {
  if (!/^\d+$/.test(value ?? '') || Number(value) > 100) throw new Error(`${label} must be an integer from 0 to 100.`);
  return Number(value);
}

function parse(args) {
  const options = { write: false, scan: false, lossless: false, quality: 82, alphaQuality: 100, files: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { options.files.push(...args.slice(i + 1)); break; }
    if (arg === '--help') options.help = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--scan') options.scan = true;
    else if (arg === '--lossless') options.lossless = true;
    else if (arg === '--quality') options.quality = percentage(args[++i], 'quality');
    else if (arg === '--alpha-quality') options.alphaQuality = percentage(args[++i], 'alpha-quality');
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else options.files.push(arg);
  }
  if (options.scan && (options.write || options.files.length)) throw new Error('--scan cannot be combined with --write or input files.');
  if (!options.help && !options.scan && !options.files.length) throw new Error('Provide explicit image paths or use --scan.');
  return options;
}

async function convert(input, options) {
  const { file } = await checkedFile(input);
  if (file === protectedFile || inside(path.join(root, 'public/favicon'), file)) throw new Error('Protected wallpaper or favicon; handle separately with explicit user direction.');
  const original = await readFile(file);
  const meta = await sharp(original).metadata();
  if ((meta.pages ?? 1) > 1) throw new Error('Animated or multi-page input is not supported.');
  if ((meta.orientation ?? 1) !== 1) throw new Error('EXIF orientation requires explicit handling before conversion; refusing to change displayed rotation.');
  if (!['png', 'jpeg'].includes(meta.format)) throw new Error(`Actual format ${meta.format} is not PNG/JPEG; no repeated lossy conversion.`);
  const ext = path.extname(file);
  const output = `${file.slice(0, -ext.length)}${ext.toLowerCase() === '.webp' ? '.optimized' : ''}.webp`;
  if (await exists(output)) throw new Error(`Output already exists: ${relative(output)}`);
  const encoded = await sharp(original).webp({ quality: options.quality, alphaQuality: options.alphaQuality,
    lossless: options.lossless, smartSubsample: true, effort: 6 }).toBuffer();
  const result = await sharp(encoded).metadata();
  if (result.format !== 'webp' || result.width !== meta.width || result.height !== meta.height) {
    throw new Error('Format or dimensions validation failed.');
  }
  if (meta.hasAlpha && !result.hasAlpha) {
    // WebP can omit a fully opaque alpha plane without losing transparency.
    const alpha = await sharp(original).extractChannel('alpha').raw().toBuffer();
    if (!alpha.every((value) => value === 255)) throw new Error('Non-opaque alpha was lost.');
  }
  if (options.lossless) {
    const pixels = (buffer) => sharp(buffer).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    const [before, after] = await Promise.all([pixels(original), pixels(encoded)]);
    if (!before.equals(after)) throw new Error('Lossless decoded pixel comparison failed.');
  }
  const beneficial = encoded.length < original.length;
  if (options.write && beneficial) {
    // Exclusive create protects existing outputs even if another process created one after the check.
    await writeFile(output, encoded, { flag: 'wx' });
  }
  return { file: relative(file), output: relative(output), format: meta.format,
    width: meta.width, height: meta.height, alpha: Boolean(result.hasAlpha),
    beforeBytes: original.length, afterBytes: encoded.length,
    savedPercent: Number(((1 - encoded.length / original.length) * 100).toFixed(2)),
    mode: options.lossless ? 'lossless' : 'lossy', quality: options.quality, alphaQuality: options.alphaQuality,
    status: !beneficial ? 'skipped-no-savings' : options.write ? 'written-original-kept' : 'dry-run' };
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node .agents/skills/fuwari-image-optimizer/scripts/optimize-images.mjs --scan\n'
      + '       node .../optimize-images.mjs [--write] [--quality 82] [--alpha-quality 100] [--lossless] <file> [file ...]\n'
      + 'Paths are relative to the repository root. Default: dry run. Never overwrites or deletes originals.');
    return;
  }
  const rows = [];
  if (options.scan) {
    for (const directory of roots) await scan(directory, rows);
    rows.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
  } else {
    for (const input of options.files) {
      try {
        rows.push(await convert(input, options));
      } catch (error) {
        rows.push({ file: input, status: 'error', error: error.message });
        process.exitCode = 1;
      }
    }
  }
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
