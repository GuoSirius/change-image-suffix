#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import sharp from 'sharp';

// 默认配置
const DEFAULT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];
const DEFAULT_TARGET_FORMAT = 'webp';

interface CliOptions {
  directory: string;
  recursive: boolean;
  maxDepth: number;
  extensions: string[];
  targetFormat: string;
  singleFile?: string;   // 单文件模式
}

// ─────────────────────────────────────────
// 右键菜单管理（仅 Windows）
// ─────────────────────────────────────────

function requireWindows(): void {
  if (os.platform() !== 'win32') {
    console.error('❌ 右键菜单功能仅支持 Windows 系统');
    process.exit(1);
  }
}

/**
 * 写注册表 key（调用 reg.exe，无需管理员权限写 HKCU）
 */
function regAdd(key: string, name: string, value: string, type = 'REG_SZ'): void {
  const cmd = `reg add "${key}" /v "${name}" /t ${type} /d "${value}" /f`;
  execSync(cmd, { stdio: 'ignore' });
}
function regAddDefault(key: string, value: string): void {
  const cmd = `reg add "${key}" /ve /d "${value}" /f`;
  execSync(cmd, { stdio: 'ignore' });
}
function regDelete(key: string): void {
  try {
    execSync(`reg delete "${key}" /f`, { stdio: 'ignore' });
  } catch {
    // 忽略不存在的键
  }
}

function installContextMenu(): void {
  requireWindows();

  // cis.cmd 的路径
  let cisCmd = '';
  try {
    cisCmd = execSync('where cis.cmd', { encoding: 'utf8' }).trim().split('\n')[0].trim();
  } catch {
    try {
      cisCmd = execSync('where cis', { encoding: 'utf8' }).trim().split('\n')[0].trim();
    } catch {
      console.error('❌ 找不到 cis 命令，请先执行 npm link 或 npm install -g change-image-suffix');
      process.exit(1);
    }
  }

  // ── 复制 ICO 到用户 AppData 目录 ──
  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'change-image-suffix');
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  const icoTarget = path.join(appDataDir, 'icon.ico');
  const icoSource = path.join(__dirname, '..', 'assets', 'icon.ico');
  if (fs.existsSync(icoSource)) {
    fs.copyFileSync(icoSource, icoTarget);
  }
  const iconPath = fs.existsSync(icoTarget) ? icoTarget : cisCmd;

  // ── 格式列表（直接注册为独立菜单项，点击即执行） ──
  const formats = [
    { label: '🌀 WebP', value: 'webp' },
    { label: '📷 JPG', value: 'jpg' },
    { label: '🖼 PNG', value: 'png' },
    { label: '📺 AVIF', value: 'avif' },
    { label: '🎞 GIF', value: 'gif' },
  ];

  /**
   * 为每种格式注册独立菜单项，点击即执行该格式
   * 第一个格式（WebP）作为主项，其他作为独立项
   */
  function registerMenu(baseKey: string, cmdTemplate: string): void {
    formats.forEach((fmt, index) => {
      const key = index === 0 ? baseKey : `${baseKey}_${fmt.value}`;
      regAddDefault(key, fmt.label);
      regAdd(key, 'Icon', iconPath);
      const cmd = cmdTemplate.replace('%FMT%', fmt.value);
      regAddDefault(`${key}\\command`, cmd);
    });
  }

  // ── 1. 目录空白处右键 ──
  const bgBase = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis';
  registerMenu(bgBase, `cmd.exe /c "${cisCmd}" -t %FMT% -p "%V"`);

  // ── 2. 目录本身右键 ──
  const dirBase = 'HKCU\\Software\\Classes\\Directory\\shell\\cis';
  registerMenu(dirBase, `cmd.exe /c "${cisCmd}" -t %FMT% -p "%1"`);

  // ── 3. 单个文件右键（仅图片文件）──
  const fileBase = 'HKCU\\Software\\Classes\\*\\shell\\cis';
  registerMenu(fileBase, `cmd.exe /c "${cisCmd}" -t %FMT% -f "%1"`);

  const appliesTo =
    'System.FileName:*.png OR System.FileName:*.jpg OR System.FileName:*.jpeg OR ' +
    'System.FileName:*.gif OR System.FileName:*.bmp OR System.FileName:*.tiff OR ' +
    'System.FileName:*.tif OR System.FileName:*.webp OR System.FileName:*.avif';
  regAdd(fileBase, 'AppliesTo', appliesTo);

  console.log('✅ 右键菜单安装成功！');
  console.log('   📁 文件夹空白处右键 → 悬停选择格式 / 点击直接转换 WebP');
  console.log('   📁 文件夹图标上右键 → 悬停选择格式 / 点击直接转换 WebP');
  console.log('   🖼  图片文件上右键   → 悬停选择格式 / 点击直接转换 WebP');
  console.log(`   📂 输出目录: <原目录>/output/`);
  console.log(`   图标位置: ${iconPath}`);
  console.log('\n💡 提示：如需卸载，执行 cis uninstall-menu');
}

function uninstallContextMenu(): void {
  requireWindows();
  // 目录空白处
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis');
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis_jpg');
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis_png');
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis_avif');
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis_gif');
  // 目录本身
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis');
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis_jpg');
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis_png');
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis_avif');
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis_gif');
  // 单文件
  regDelete('HKCU\\Software\\Classes\\*\\shell\\cis');
  regDelete('HKCU\\Software\\Classes\\*\\shell\\cis_jpg');
  regDelete('HKCU\\Software\\Classes\\*\\shell\\cis_png');
  regDelete('HKCU\\Software\\Classes\\*\\shell\\cis_avif');
  regDelete('HKCU\\Software\\Classes\\*\\shell\\cis_gif');
  console.log('✅ 右键菜单已卸载（目录 + 文件，所有格式）');
}

// ─────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  let directory = process.cwd();
  let recursive = false;
  let maxDepth = Infinity;
  let extensions: string[] = DEFAULT_EXTENSIONS;
  let targetFormat = DEFAULT_TARGET_FORMAT;
  let singleFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-r' || arg === '--recursive') { recursive = true; continue; }

    if (arg === '-d' || arg === '--depth') {
      if (i + 1 < args.length) {
        maxDepth = parseInt(args[++i], 10);
        if (isNaN(maxDepth) || maxDepth < 1) {
          console.error('❌ 深度必须是正整数');
          process.exit(1);
        }
      }
      continue;
    }

    if (arg === '-e' || arg === '--extensions') {
      if (i + 1 < args.length) {
        extensions = args[++i].split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
      }
      continue;
    }

    if (arg === '-t' || arg === '--to') {
      if (i + 1 < args.length) {
        targetFormat = args[++i].trim().toLowerCase().replace(/^\./, '');
      }
      continue;
    }

    if (arg === '-h' || arg === '--help') { printHelp(); process.exit(0); }

    if (arg === '-v' || arg === '--version') {
      console.log('change-image-suffix v1.6.0');
      process.exit(0);
    }

    if (arg === '-p' || arg === '--path') {
      if (i + 1 < args.length) {
        directory = path.resolve(args[++i]);
      }
      continue;
    }

    if (arg === '-f' || arg === '--file') {
      if (i + 1 < args.length) {
        singleFile = path.resolve(args[++i]);
      }
      continue;
    }

    if (!arg.startsWith('-')) {
      // 位置参数：若是文件则当作单文件，否则当作目录
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        singleFile = resolved;
      } else {
        directory = resolved;
      }
    }
  }

  // 单文件模式：验证文件
  if (singleFile) {
    if (!fs.existsSync(singleFile)) {
      console.error(`❌ 文件不存在: ${singleFile}`);
      process.exit(1);
    }
    if (!fs.statSync(singleFile).isFile()) {
      console.error(`❌ 路径不是文件: ${singleFile}`);
      process.exit(1);
    }
    return { directory, recursive, maxDepth, extensions, targetFormat, singleFile };
  }

  // 目录模式：验证目录
  if (!fs.existsSync(directory)) {
    console.error(`❌ 目录不存在: ${directory}`);
    process.exit(1);
  }

  if (!fs.statSync(directory).isDirectory()) {
    console.error(`❌ 路径不是目录: ${directory}`);
    process.exit(1);
  }

  return { directory, recursive, maxDepth, extensions, targetFormat };
}

function printHelp(): void {
  console.log(`
🔄 change-image-suffix - 图片格式批量转换工具

用法:
  change-image-suffix [选项]
  cis [选项]                     # 简写
  cis install-menu               # 添加到 Windows 右键菜单
  cis uninstall-menu             # 从 Windows 右键菜单移除

选项:
  -f, --file <file>       转换单个文件（右键文件时自动传入）
  -p, --path <dir>        指定工作目录（默认: 当前目录）
  -r, --recursive         递归搜索子目录
  -d, --depth <n>         递归深度限制（需要 -r 选项）
  -e, --extensions <ext>  指定要转换的后缀，逗号分隔（不含点号）
  -t, --to <format>       转换到的目标格式（默认: webp）
  -h, --help              显示帮助信息
  -v, --version           显示版本信息

示例:
  cis                              # 转换当前目录的图片为 webp
  cis -f ./photo.png               # 转换单个文件
  cis -p ./images                  # 转换指定目录
  cis -r                           # 递归转换当前目录
  cis -r -d 2 -p ./images          # 递归转换，深度限制为2
  cis -e png,jpg -t jpg            # png/jpg 转换为 jpg
  cis install-menu                 # 注册 Windows 右键菜单
`);
}

// ─────────────────────────────────────────
// 图片处理
// ─────────────────────────────────────────

function getAllFiles(
  dir: string,
  extensions: string[],
  recursive: boolean,
  currentDepth: number,
  maxDepth: number
): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && recursive && currentDepth < maxDepth) {
        files.push(...getAllFiles(fullPath, extensions, recursive, currentDepth + 1, maxDepth));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    console.warn(`⚠️  无法读取目录: ${dir}`);
  }

  return files;
}

function getOutputPath(
  inputPath: string,
  targetFormat: string,
  allInputFiles: string[]
): string {
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const originalExt = ext.slice(1).toLowerCase();
  const targetExt = targetFormat;

  // 源格式与目标格式相同时，保留双重后缀
  let coreName = originalExt === targetExt
    ? `${basename}.${originalExt}`
    : basename;

  const outputDir = path.join(dir, 'output');

  // 检查输入目录中是否有同名（不含扩展名）但不同后缀的文件
  // 如 photo.png 和 photo.jpg 会被判定为同名冲突
  const hasNameConflict = allInputFiles.some(f => {
    if (f === inputPath) return false;
    const fDir = path.dirname(f);
    const fExt = path.extname(f);
    const fBasename = path.basename(f, fExt);
    return fDir === dir && fBasename === basename && fExt.toLowerCase() !== ext.toLowerCase();
  });

  if (hasNameConflict) {
    // 找所有同basename的文件的序号
    const allBasenameMatches = allInputFiles.filter(f => {
      if (f === inputPath) return false;
      const fDir = path.dirname(f);
      const fExt = path.extname(f);
      const fBasename = path.basename(f, fExt);
      return fDir === dir && fBasename === basename;
    });
    // 当前文件在所有同名文件中的索引（从1开始）
    const sortedMatches = [...allBasenameMatches, inputPath].sort();
    const index = sortedMatches.indexOf(inputPath) + 1;
    const padded = String(index).padStart(2, '0');
    coreName = `${basename}_${padded}`;
  }

  const filename = `${coreName}.${targetExt}`;
  return path.join(outputDir, filename);
}

async function convertImage(
  inputPath: string,
  targetFormat: string,
  allInputFiles: string[]
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  try {
    const outputPath = getOutputPath(inputPath, targetFormat, allInputFiles);

    // 确保 output 目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const image = sharp(inputPath);

    switch (targetFormat.toLowerCase()) {
      case 'webp': await image.webp({ quality: 85 }).toFile(outputPath); break;
      case 'jpg':
      case 'jpeg': await image.jpeg({ quality: 85 }).toFile(outputPath); break;
      case 'png':  await image.png({ quality: 85 }).toFile(outputPath); break;
      case 'gif':  await image.gif().toFile(outputPath); break;
      case 'tiff':
      case 'tif':  await image.tiff({ quality: 85 }).toFile(outputPath); break;
      case 'avif': await image.avif({ quality: 85 }).toFile(outputPath); break;
      default:     await image.toFormat(targetFormat as any).toFile(outputPath);
    }

    return { success: true, outputPath };
  } catch (err) {
    return {
      success: false,
      outputPath: inputPath,
      error: err instanceof Error ? err.message : '未知错误'
    };
  }
}

// ─────────────────────────────────────────
// 入口
// ─────────────────────────────────────────

async function main(): Promise<void> {
  const firstArg = process.argv[2];

  // 子命令：右键菜单管理
  if (firstArg === 'install-menu') {
    installContextMenu();
    return;
  }
  if (firstArg === 'uninstall-menu') {
    uninstallContextMenu();
    return;
  }

  console.log('\n🖼️  change-image-suffix - 图片格式批量转换工具\n');

  const options = parseArgs();

  // ─── 单文件模式 ───
  if (options.singleFile) {
    const filePath = options.singleFile;
    const ext = path.extname(filePath).slice(1).toLowerCase();

    console.log(`📄 文件: ${filePath}`);
    console.log(`🎯 目标格式: ${options.targetFormat}`);
    console.log('\n----------------------------------------\n');

    // 检查文件后缀是否是支持的图片格式
    const supportedExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'avif'];
    if (!supportedExts.includes(ext)) {
      console.error(`❌ 不支持的文件格式: .${ext}`);
      console.error(`   支持的格式: ${supportedExts.join(', ')}`);
      process.exit(1);
    }

    process.stdout.write(`  处理中: ${path.basename(filePath)} ... `);
    const result = await convertImage(filePath, options.targetFormat, [filePath]);

    if (result.success) {
      console.log(`✅ -> ${path.basename(result.outputPath)}`);
      console.log(`\n   输出文件: ${result.outputPath}`);
      console.log('\n✅ 转换完成！\n');
    } else {
      console.log(`❌ 失败 (${result.error})`);
      process.exit(1);
    }
    return;
  }

  // ─── 目录批量模式 ───
  console.log(`📂 目录: ${options.directory}`);
  console.log(`🔁 递归: ${options.recursive ? `是 (深度: ${options.maxDepth === Infinity ? '无限制' : options.maxDepth})` : '否'}`);
  console.log(`📄 后缀: ${options.extensions.join(', ')}`);
  console.log(`🎯 目标格式: ${options.targetFormat}`);
  console.log('\n----------------------------------------\n');

  const files = getAllFiles(options.directory, options.extensions, options.recursive, 0, options.maxDepth);

  if (files.length === 0) {
    console.log('✅ 没有找到需要转换的图片文件。');
    return;
  }

  console.log(`📋 找到 ${files.length} 个文件，准备开始转换...\n`);

  let successCount = 0;
  let failCount = 0;
  const results: { input: string; output: string; status: 'success' | 'fail' }[] = [];

  for (const file of files) {
    const relativePath = path.relative(options.directory, file);
    process.stdout.write(`  处理中: ${relativePath} ... `);

    const result = await convertImage(file, options.targetFormat, files);

    if (result.success) {
      const outputRelativePath = path.relative(options.directory, result.outputPath);
      console.log(`✅ -> ${outputRelativePath}`);
      results.push({ input: file, output: result.outputPath, status: 'success' });
      successCount++;
    } else {
      console.log(`❌ 失败 (${result.error})`);
      results.push({ input: file, output: '', status: 'fail' });
      failCount++;
    }
  }

  console.log('\n----------------------------------------');
  console.log(`\n📊 转换完成！成功: ${successCount}, 失败: ${failCount}\n`);

  if (failCount > 0) {
    console.log('❌ 失败的文件:');
    for (const r of results.filter(x => x.status === 'fail')) {
      console.log(`   - ${r.input}`);
    }
  }
}

main().catch(console.error);
