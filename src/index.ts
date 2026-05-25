#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 支持的输入/输出格式
const SUPPORTED_INPUT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'avif'];
const SUPPORTED_OUTPUT_FORMATS = ['webp', 'jpg', 'jpeg', 'png', 'avif', 'tiff', 'tif'];
const DEFAULT_EXTENSIONS = [...SUPPORTED_INPUT_EXTENSIONS];
const DEFAULT_TARGET_FORMAT = 'webp';

interface CliOptions {
  directory: string;
  recursive: boolean;
  maxDepth: number;
  extensions: string[];
  targetFormat: string;
  multiFiles?: string[];  // 多文件模式（多选文件）
  multiPaths?: string[];   // 多路径模式（多选文件/目录混合）
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

function regDelete(key: string): void {
  try {
    execSync(`reg delete "${key}" /f`, { stdio: 'ignore' });
  } catch {
    // 忽略不存在的键
  }
}

function installContextMenu(): void {
  requireWindows();

  // ── 查找 cis.cmd 路径 ──
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

  // ── 复制 ICO ──
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

  // 绕过 cmd.exe 编码问题：直接用 node.exe 调用，避免 bat/cmd 的 GBK/Unicode 转换
  const nodeExe = process.execPath;
  const scriptPath = path.join(__dirname, 'index.js');

  // ── 格式列表（webp 排第一，其他按常见程度排序）──
  const formats = [
    { verb: 'webp', label: '🌀 WebP' },
    { verb: 'jpg', label: '📷 JPG' },
    { verb: 'png', label: '🖼 PNG' },
    { verb: 'avif', label: '📺 AVIF' },
    { verb: 'tiff', label: '📋 TIFF' },
  ];

  // ── 使用 ExtendedSubCommandsKey，直接调用 node.exe（无 bat 中转）──
  const menuBases = [
    { base: 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis', arg: '-p .' },
    { base: 'HKCU\\Software\\Classes\\Directory\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_dir', arg: '-p %1' },
    { base: 'HKCU\\Software\\Classes\\*\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_file', arg: '-f %1' },
  ];

  // 1. 注册格式子菜单
  const REG_ROOT = 'HKCU\\Software\\Classes\\';
  for (const menu of menuBases) {
    for (const fmt of formats) {
      const shellKey = `${REG_ROOT}${menu.subMenu}\\shell\\${fmt.verb}`;
      const cmd = `"${nodeExe}" "${scriptPath}" --pause -t ${fmt.verb} ${menu.arg}`;
      execSync(`reg add "${shellKey}" /ve /d "${fmt.label}" /f`, { stdio: 'ignore' });
      execSync(`reg add "${shellKey}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
      execSync(`reg add "${shellKey}\\command" /ve /d "${cmd}" /f`, { stdio: 'ignore' });
    }
  }

  // 2. 注册主菜单项
  for (const menu of menuBases) {
    execSync(`reg add "${menu.base}" /ve /d "🖼 转换图片 (cis)" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v ExtendedSubCommandsKey /d "${menu.subMenu}" /f`, { stdio: 'ignore' });
  }

  // 写入版本标记，用于检测 npm update 后自动刷新菜单
  const versionFile = path.join(appDataDir, 'version.json');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  fs.writeFileSync(versionFile, JSON.stringify({ version: pkg.version }), 'utf8');

  console.log('✅ 右键菜单安装成功！');
  console.log('   📁 文件夹空白处/图标右键 → 悬停展开格式子菜单');
  console.log('   🖼  图片文件上右键       → 悬停展开格式子菜单');
  console.log('   ⚠️  非图片文件右键       → 菜单显示但不处理');
  console.log(`   📂 输出目录: <原目录>/<目标格式>/`);
  console.log('\n💡 提示：如需卸载，执行 cis uninstall-menu');
}

function uninstallContextMenu(): void {
  requireWindows();

  // 删除主菜单项
  const mainKeys = [
    'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis',
    'HKCU\\Software\\Classes\\Directory\\shell\\cis',
    'HKCU\\Software\\Classes\\*\\shell\\cis',
  ];

  for (const key of mainKeys) {
    try {
      execSync(`reg delete "${key}" /f`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  // 删除公共子菜单（三个：目录空白、目录图标、文件）
  const subMenuRoots = [
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis',
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis_dir',
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis_file',
  ];

  for (const root of subMenuRoots) {
    try {
      execSync(`reg delete "${root}" /f`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  // 删除批处理文件、图标和版本标记
  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'change-image-suffix');
  const batPath = path.join(appDataDir, 'cis_file.bat');
  try { fs.unlinkSync(batPath); } catch { /* ignore */ }
  const iconPath = path.join(appDataDir, 'icon.ico');
  try { fs.unlinkSync(iconPath); } catch { /* ignore */ }
  const versionFile = path.join(appDataDir, 'version.json');
  try { fs.unlinkSync(versionFile); } catch { /* ignore */ }
  // 尝试删除目录（仅当为空时），失败也不影响
  try { fs.rmdirSync(appDataDir); } catch { /* ignore */ }

  console.log('✅ 右键菜单已卸载');
}

// 自动检测版本变化并更新右键菜单（解决 npm update 不触发 postinstall 的问题）
function autoUpdateContextMenu(): void {
  if (os.platform() !== 'win32') return;

  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'change-image-suffix');
  const versionFile = path.join(appDataDir, 'version.json');

  // 如果从未安装过右键菜单，跳过自动更新（postinstall 负责首次安装）
  if (!fs.existsSync(versionFile)) return;

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const currentVersion = pkg.version;

  let installedVersion = '';
  try {
    installedVersion = JSON.parse(fs.readFileSync(versionFile, 'utf8')).version || '';
  } catch { /* ignore */ }

  if (installedVersion !== currentVersion) {
    try {
      installContextMenu();
    } catch {
      console.warn('⚠️  右键菜单自动更新失败，请手动执行 cis install-menu');
    }
  }
}

// ─────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const options: CliOptions = {
    directory: process.cwd(),
    recursive: false,
    maxDepth: Infinity,
    extensions: [...DEFAULT_EXTENSIONS],
    targetFormat: DEFAULT_TARGET_FORMAT,
  };

  // 用于分类收集的临时数组
  let filesFromFlag: string[] = [];      // -f 收集的文件
  let dirsFromFlag: string[] = [];       // -p 收集的目录
  let positionalFiles: string[] = [];     // 位置参数中的文件
  let positionalDirs: string[] = [];      // 位置参数中的目录

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-r' || arg === '--recursive') {
      options.recursive = true;
      i++;
      continue;
    }

    if (arg === '-d' || arg === '--depth') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 1) {
          console.error('❌ 深度必须是正整数');
          process.exit(1);
        }
        options.maxDepth = val;
      } else {
        console.error('❌ -d/--depth 需要指定一个正整数参数');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '-e' || arg === '--extensions') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.extensions = args[++i].split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
      } else {
        console.error('❌ -e/--extensions 需要指定后缀参数');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '-t' || arg === '--to') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.targetFormat = args[++i].trim().toLowerCase().replace(/^\./, '');
      } else {
        console.error('❌ -t/--to 需要指定目标格式');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      console.log(`change-image-suffix v${pkg.version}`);
      process.exit(0);
    }

    if (arg === '-p' || arg === '--path') {
      // 收集 -p 后的目录
      const start = i + 1;
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        dirsFromFlag.push(path.resolve(args[i]));
      }
      // 如果 -p 后面没有参数，用当前目录
      if (start > i) {
        dirsFromFlag.push(path.resolve('.'));
      }
      i++;
      continue;
    }

    if (arg === '-f' || arg === '--file') {
      // 收集 -f 后的所有文件
      const start = i + 1;
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        filesFromFlag.push(path.resolve(args[i]));
      }
      if (start > i) {
        console.error('❌ -f/--file 需要指定至少一个文件路径');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (!arg.startsWith('-')) {
      // 位置参数：根据实际类型分类
      const resolvedPath = path.resolve(arg);
      if (fs.existsSync(resolvedPath)) {
        if (fs.statSync(resolvedPath).isFile()) {
          positionalFiles.push(resolvedPath);
        } else {
          positionalDirs.push(resolvedPath);
        }
      } else {
        // 文件不存在但不是以 - 开头，当作文件收集（后续验证会报错）
        positionalFiles.push(resolvedPath);
      }
      i++;
      continue;
    }

    // 未知选项，跳过
    i++;
  }

  // ─── 合并所有收集的内容 ───

  // 合并文件：-f 收集的 + 位置参数中的文件
  const allFiles = [...filesFromFlag, ...positionalFiles];

  // 合并目录：-p 收集的 + 位置参数中的目录
  const allDirs = [...dirsFromFlag, ...positionalDirs];

  // ─── 确定最终模式 ───

  // 情况1：只有文件（单文件/多文件模式）
  if (allFiles.length > 0 && allDirs.length === 0) {
    options.multiFiles = allFiles;
    return options;
  }

  // 情况2：只有目录（单目录/多目录模式）
  if (allDirs.length > 0 && allFiles.length === 0) {
    if (allDirs.length === 1) {
      options.directory = allDirs[0];
    } else {
      options.multiPaths = allDirs;
    }
    return options;
  }

  // 情况3：文件和目录混合（混合模式）
  if (allFiles.length > 0 && allDirs.length > 0) {
    options.multiFiles = allFiles;
    options.multiPaths = allDirs;
    return options;
  }

  // 情况4：没有任何路径参数，使用当前目录
  return options;
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
  -f, --file <file>       转换指定文件（可多个，空格分隔）
  -p, --path <dir>        指定工作目录（默认: 当前目录）
  -r, --recursive         递归搜索子目录
  -d, --depth <n>         递归深度限制（需要 -r 选项）
  -e, --extensions <ext>  指定源后缀，逗号分隔（不含点号）
  -t, --to <format>       目标格式: webp, jpg/jpeg, png, avif, tiff/tif（默认: webp）
  -h, --help              显示帮助信息
  -v, --version           显示版本信息

示例:
  cis                              # 转换当前目录的图片为 webp
  cis -f ./photo.png               # 转换单个文件
  cis -p ./images                  # 转换指定目录
  cis -r                           # 递归转换当前目录
  cis -r -d 2 -p ./images         # 递归转换，深度限制为2
  cis -e png,jpg -t jpg           # png/jpg 转换为 jpg
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
  maxDepth: number,
  excludeDirName?: string
): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && recursive && currentDepth < maxDepth) {
        if (excludeDirName && entry.name === excludeDirName) continue;
        files.push(...getAllFiles(fullPath, extensions, recursive, currentDepth + 1, maxDepth, excludeDirName));
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
  const targetExt = targetFormat;

  let coreName = basename;

  const outputDir = path.join(dir, targetFormat);

  // 检查输入目录中是否有同名（不含扩展名）但不同后缀的文件
  // 如 photo.png 和 photo.jpg 会被判定为同名冲突
  const hasNameConflict = allInputFiles.some(f => {
    if (f === inputPath) return false;
    const fDir = path.dirname(f);
    const fExt = path.extname(f);
    const fBasename = path.basename(f, fExt);
    return fDir === dir && fBasename.toLowerCase() === basename.toLowerCase() && fExt.toLowerCase() !== ext.toLowerCase();
  });

  if (hasNameConflict) {
    // 找所有同basename的文件的序号
    const allBasenameMatches = allInputFiles.filter(f => {
      if (f === inputPath) return false;
      const fDir = path.dirname(f);
      const fExt = path.extname(f);
      const fBasename = path.basename(f, fExt);
      return fDir === dir && fBasename.toLowerCase() === basename.toLowerCase();
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
  const outputPath = getOutputPath(inputPath, targetFormat, allInputFiles);
  const srcExt = path.extname(inputPath).slice(1).toLowerCase();
  const fmt = targetFormat.toLowerCase();

  // 先验证格式，避免在无效路径上创建目录
  if (!SUPPORTED_OUTPUT_FORMATS.includes(fmt)) {
    return { success: false, outputPath, error: `不支持的目标格式: ${targetFormat}，支持: ${SUPPORTED_OUTPUT_FORMATS.join(', ')}` };
  }

  try {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 同格式直接复制，避免重新编码导致质量损失
    if (srcExt === fmt || (srcExt === 'jpeg' && fmt === 'jpg') || (srcExt === 'jpg' && fmt === 'jpeg') || (srcExt === 'tif' && fmt === 'tiff') || (srcExt === 'tiff' && fmt === 'tif')) {
      fs.copyFileSync(inputPath, outputPath);
      return { success: true, outputPath };
    }

    const image = sharp(inputPath);

    switch (fmt) {
      case 'webp': await image.webp({ quality: 90 }).toFile(outputPath); break;
      case 'jpg':
      case 'jpeg': await image.jpeg({ quality: 90 }).toFile(outputPath); break;
      case 'png':  await image.png({ compressionLevel: 6 }).toFile(outputPath); break;
      case 'tiff':
      case 'tif':  await image.tiff({ quality: 90 }).toFile(outputPath); break;
      case 'avif': await image.avif({ quality: 90 }).toFile(outputPath); break;
    }

    return { success: true, outputPath };
  } catch (err) {
    return {
      success: false,
      outputPath,
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

  // 自动检测版本变化并刷新右键菜单（npm update 不触发 postinstall）
  autoUpdateContextMenu();

  console.log('\n🖼️  change-image-suffix - 图片格式批量转换工具\n');

  const options = parseArgs();

  // ─── 辅助函数：处理文件列表 ───
  async function processFiles(files: string[], title: string): Promise<{ success: number; fail: number }> {
    console.log(`\n🖼️  change-image-suffix - ${title}\n`);
    console.log(`🎯 目标格式: ${options.targetFormat}`);
    console.log(`📦 待处理: ${files.length} 个文件\n`);
    console.log('----------------------------------------\n');

    let totalSuccess = 0;
    let totalFail = 0;
    const failures: string[] = [];

    for (const filePath of files) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!SUPPORTED_INPUT_EXTENSIONS.includes(ext)) {
        console.log(`  ⚠️  跳过（不支持格式）: ${filePath}`);
        totalFail++;
        failures.push(filePath);
        continue;
      }

      console.log(`  📄 文件: ${filePath}`);
      process.stdout.write(`     处理中: ${path.basename(filePath)} ... `);
      const result = await convertImage(filePath, options.targetFormat, files);

      if (result.success) {
        console.log(`✅ -> ${path.relative(path.dirname(filePath), result.outputPath)}`);
        totalSuccess++;
      } else {
        console.log(`❌ 失败 (${result.error})`);
        totalFail++;
        failures.push(filePath);
      }
    }

    if (failures.length > 0) {
      console.log('\n❌ 失败的文件:');
      for (const f of failures) {
        console.log(`   - ${f}`);
      }
    }

    return { success: totalSuccess, fail: totalFail };
  }

  // ─── 辅助函数：处理目录列表 ───
  async function processDirs(dirs: string[]): Promise<{ success: number; fail: number }> {
    console.log(`\n🎯 目标格式: ${options.targetFormat}`);
    console.log(`📦 待处理: ${dirs.length} 个目录\n`);
    console.log('----------------------------------------\n');

    let totalSuccess = 0;
    let totalFail = 0;
    const failures: string[] = [];

    for (const inputPath of dirs) {
      const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;

      if (!stat) {
        console.log(`  ⚠️  跳过（不存在）: ${inputPath}`);
        totalFail++;
        failures.push(inputPath);
        continue;
      }

      if (stat.isFile()) {
        const ext = path.extname(inputPath).slice(1).toLowerCase();
        if (!SUPPORTED_INPUT_EXTENSIONS.includes(ext)) {
          console.log(`  ⚠️  跳过（不支持格式）: ${inputPath}`);
          totalFail++;
          failures.push(inputPath);
          continue;
        }

        console.log(`  📄 文件: ${inputPath}`);
        process.stdout.write(`     处理中: ${path.basename(inputPath)} ... `);
        const result = await convertImage(inputPath, options.targetFormat, dirs);
        if (result.success) {
          console.log(`✅ -> ${path.relative(path.dirname(inputPath), result.outputPath)}`);
          totalSuccess++;
        } else {
          console.log(`❌ 失败 (${result.error})`);
          totalFail++;
          failures.push(inputPath);
        }
      } else {
        const files = getAllFiles(inputPath, options.extensions, options.recursive, 0, options.maxDepth, options.targetFormat);
        console.log(`  📁 目录: ${inputPath} (${files.length} 个文件)`);

        if (files.length === 0) {
          console.log('     ✅ 没有找到图片文件');
          continue;
        }

        for (const file of files) {
          process.stdout.write(`     处理中: ${path.basename(file)} ... `);
          const result = await convertImage(file, options.targetFormat, files);
          if (result.success) {
            console.log(`✅`);
            totalSuccess++;
          } else {
            console.log(`❌ (${result.error})`);
            totalFail++;
            failures.push(file);
          }
        }
      }
    }

    if (failures.length > 0) {
      console.log('\n❌ 失败的文件:');
      for (const f of failures) {
        console.log(`   - ${f}`);
      }
    }

    return { success: totalSuccess, fail: totalFail };
  }

  let totalFail = 0;

  // ─── 混合模式：同时有文件和目录 ───
  if (options.multiFiles && options.multiFiles.length > 0 && options.multiPaths && options.multiPaths.length > 0) {
    console.log('\n🖼️  change-image-suffix - 混合模式（文件+目录）\n');
    const fileResult = await processFiles(options.multiFiles, '图片转换工具');
    console.log('\n');
    const dirResult = await processDirs(options.multiPaths);
    totalFail = fileResult.fail + dirResult.fail;
    console.log('\n----------------------------------------');
    console.log(`📊 转换完成！成功: ${fileResult.success + dirResult.success}, 失败: ${totalFail}\n`);
  } else if (options.multiFiles && options.multiFiles.length > 0) {
    // ─── 单/多文件模式 ───
    const result = await processFiles(options.multiFiles, '图片转换工具');
    totalFail = result.fail;
    console.log('\n----------------------------------------\n');
    console.log(`📊 转换完成！成功: ${result.success}, 失败: ${result.fail}\n`);
  } else if (options.multiPaths) {
    // ─── 多路径模式 ───
    console.log(`\n🖼️  change-image-suffix - 批量转换工具\n`);
    const result = await processDirs(options.multiPaths);
    totalFail = result.fail;
    console.log('\n----------------------------------------');
    console.log(`📊 转换完成！成功: ${result.success}, 失败: ${result.fail}\n`);
  } else {
    // ─── 目录批量模式 ───
    console.log(`📂 目录: ${options.directory}`);
    console.log(`🔁 递归: ${options.recursive ? `是 (深度: ${options.maxDepth === Infinity ? '无限制' : options.maxDepth})` : '否'}`);
    console.log(`📄 后缀: ${options.extensions.join(', ')}`);
    console.log(`🎯 目标格式: ${options.targetFormat}`);
    console.log('\n----------------------------------------\n');

    const files = getAllFiles(options.directory, options.extensions, options.recursive, 0, options.maxDepth, options.targetFormat);

    if (files.length === 0) {
      console.log('✅ 没有找到需要转换的图片文件。');
    } else {
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

      totalFail = failCount;

      console.log('\n----------------------------------------');
      console.log(`\n📊 转换完成！成功: ${successCount}, 失败: ${failCount}\n`);

      if (failCount > 0) {
        console.log('❌ 失败的文件:');
        for (const r of results.filter(x => x.status === 'fail')) {
          console.log(`   - ${r.input}`);
        }
      }
    }
  }

  // 右键菜单调用时，仅在有失败时暂停让用户查看
  if (process.argv.includes('--pause') && totalFail > 0) {
    console.log('\n按任意键退出...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise<void>(resolve => {
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        resolve();
      });
    });
  }
}

main().catch(console.error);
