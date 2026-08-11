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
  mode: 'convert' | 'crop';      // 操作模式：转换 / 空白裁剪
  cropPadding: number;           // 裁剪后四周留白像素（默认 0）
  cropBg?: [number, number, number]; // 自定义背景色 RGB（用于裁剪接近该色的区域）
  cropBgTolerance: number;       // 背景色容差（每个通道差值上限，默认 10）
  cropWhiteTolerance: number;    // 白底容差（rgb 低于 255 的上限，默认 8）
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

  // ── 格式列表（webp 排第一，其他按常见程度排序；crop 为空白裁剪）──
  const formats = [
    { verb: 'crop', label: '📐 裁剪空白' },
    { verb: 'webp', label: 'WebP' },
    { verb: 'jpg', label: 'JPG' },
    { verb: 'png', label: 'PNG' },
    { verb: 'avif', label: 'AVIF' },
    { verb: 'tiff', label: 'TIFF' },
  ];

  // ── 使用 ExtendedSubCommandsKey，直接调用 node.exe（无 bat 中转）──
  // AllFilesystemObjects 覆盖文件和目录，支持混合多选
  const menuBases = [
    { base: 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis', arg: '-p "%V"' },
    { base: 'HKCU\\Software\\Classes\\AllFilesystemObjects\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_afo', arg: '"%1"', multiSelect: true },
  ];

  // 1. 用 .reg 文件写子菜单（避免 cmd.exe 引号嵌套解析出错）
  const regLines: string[] = ['Windows Registry Editor Version 5.00', ''];
  for (const menu of menuBases) {
    for (const fmt of formats) {
      // .reg 语法：值内 \" → 引号，\\ → 反斜杠，%1/%V 保持原样
      // crop 是子命令而非目标格式，命令结构不同
      const cmd = fmt.verb === 'crop'
        ? `"${nodeExe}" "${scriptPath}" --pause crop ${menu.arg}`
        : `"${nodeExe}" "${scriptPath}" --pause -t ${fmt.verb} ${menu.arg}`;
      const cmdEscaped = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const key = `HKEY_CURRENT_USER\\Software\\Classes\\${menu.subMenu}\\shell\\${fmt.verb}`;
      regLines.push(`[${key}]`);
      regLines.push(`@="${fmt.label}"`);
      regLines.push(`"Icon"="${iconPath.replace(/\\/g, '\\\\')}"`);
      regLines.push(`[${key}\\command]`);
      regLines.push(`@="${cmdEscaped}"`);
      regLines.push('');
    }
  }
  const regFile = path.join(appDataDir, 'cis_menu.reg');
  fs.writeFileSync(regFile, regLines.join('\r\n'), 'utf8');
  execSync(`reg import "${regFile}"`, { stdio: 'ignore' });
  try { fs.unlinkSync(regFile); } catch { /* ignore */ }

  // 2. 注册主菜单项
  for (const menu of menuBases) {
    execSync(`reg add "${menu.base}" /ve /d "🖼 转换图片 (cis)" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v ExtendedSubCommandsKey /d "${menu.subMenu}" /f`, { stdio: 'ignore' });
    if ((menu as any).multiSelect) {
      execSync(`reg add "${menu.base}" /v MultiSelectModel /d Player /f`, { stdio: 'ignore' });
    }
  }

  // 写入版本标记，用于检测 npm update 后自动刷新菜单
  const versionFile = path.join(appDataDir, 'version.json');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  fs.writeFileSync(versionFile, JSON.stringify({ version: pkg.version }), 'utf8');

  console.log('✅ 右键菜单安装成功！');
  console.log('   📁 文件夹空白处/图标右键 → 悬停展开格式/裁剪子菜单');
  console.log('   🖼  图片文件上右键       → 悬停展开格式/裁剪子菜单');
  console.log('   ⚠️  非图片文件右键       → 菜单显示但不处理');
  console.log(`   📂 转换输出: <原目录>/<目标格式>/`);
  console.log(`   ✂️  裁剪输出: <原目录>/cropped/`);
  console.log('\n💡 提示：如需卸载，执行 cis uninstall-menu');
}

function uninstallContextMenu(): void {
  requireWindows();

  // 删除主菜单项（含旧版残留）
  const mainKeys = [
    'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis',
    'HKCU\\Software\\Classes\\AllFilesystemObjects\\shell\\cis',
    'HKCU\\Software\\Classes\\Directory\\shell\\cis',    // 旧版残留
    'HKCU\\Software\\Classes\\*\\shell\\cis',           // 旧版残留
  ];

  for (const key of mainKeys) {
    try {
      execSync(`reg delete "${key}" /f`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  // 删除公共子菜单
  const subMenuRoots = [
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis',
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis_dir',   // 旧版残留
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis_file', // 旧版残留
    'HKCU\\Software\\Classes\\Directory\\ContextMenus\\cis_afo',
  ];

  for (const root of subMenuRoots) {
    try {
      execSync(`reg delete "${root}" /f`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  // 删除遗留文件（旧版 bat 脚本、图标、版本标记）
  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'change-image-suffix');
  const batPath = path.join(appDataDir, 'cis_file.bat');
  try { fs.unlinkSync(batPath); } catch { /* ignore */ } // 旧版残留清理
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

// Windows ExtendedSubCommandsKey 会将含空格的路径拆成多段参数，
// 此函数尝试将拆散的片段拼接回完整路径。
function resolveSplitPath(parts: string[]): string[] {
  if (parts.length === 1) return [path.resolve(parts[0])];

  // 尝试将拆散的片段用空格拼接回完整路径（右键菜单可能将含空格的路径拆成多段）
  const fullJoin = parts.join(' ');
  if (fs.existsSync(fullJoin)) return [path.resolve(fullJoin)];

  // 无法拼接为单个存在的路径 → 各段视为独立路径（用户主动传了多个路径）
  return parts.map(p => path.resolve(p));
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const options: CliOptions = {
    directory: process.cwd(),
    recursive: false,
    maxDepth: Infinity,
    extensions: [...DEFAULT_EXTENSIONS],
    targetFormat: DEFAULT_TARGET_FORMAT,
    mode: 'convert',
    cropPadding: 0,
    cropBgTolerance: 10,
    cropWhiteTolerance: 8,
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

    // ─── 裁剪相关参数（仅 crop 模式生效，convert 模式忽略）───

    if (arg === '-b' || arg === '--bg') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const parts = args[++i].split(',').map(s => parseInt(s.trim(), 10));
        if (parts.length !== 3 || parts.some(n => isNaN(n) || n < 0 || n > 255)) {
          console.error('❌ --bg 需要 3 个 0-255 的 RGB 值，逗号分隔，如 --bg 255,255,255');
          process.exit(1);
        }
        options.cropBg = parts as [number, number, number];
      } else {
        console.error('❌ --bg 需要指定 RGB 参数');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '--padding') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          console.error('❌ --padding 必须是非负整数');
          process.exit(1);
        }
        options.cropPadding = val;
      } else {
        console.error('❌ --padding 需要指定像素值');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '--tolerance') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          console.error('❌ --tolerance 必须是非负整数');
          process.exit(1);
        }
        options.cropBgTolerance = val;
      } else {
        console.error('❌ --tolerance 需要指定容差值');
        process.exit(1);
      }
      i++;
      continue;
    }

    if (arg === '--white-tolerance') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 0) {
          console.error('❌ --white-tolerance 必须是非负整数');
          process.exit(1);
        }
        options.cropWhiteTolerance = val;
      } else {
        console.error('❌ --white-tolerance 需要指定容差值');
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
      // 收集 -p 后的目录（Windows 右键菜单可能将含空格的路径拆成多段，需尝试拼接）
      const parts: string[] = [];
      const start = i + 1;
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        parts.push(args[i]);
      }
      if (parts.length === 0) {
        dirsFromFlag.push(path.resolve('.'));
      } else {
        dirsFromFlag.push(...resolveSplitPath(parts));
      }
      i++;
      continue;
    }

    if (arg === '-f' || arg === '--file') {
      const parts: string[] = [];
      const start = i + 1;
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        parts.push(args[i]);
      }
      if (parts.length === 0) {
        console.error('❌ -f/--file 需要指定至少一个文件路径');
        process.exit(1);
      }
      filesFromFlag.push(...resolveSplitPath(parts));
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
  cis crop [选项] [路径]          # 裁剪图片四周空白到 cropped/ 子目录
  cis install-menu               # 添加到 Windows 右键菜单
  cis uninstall-menu             # 从 Windows 右键菜单移除

转换选项:
  -f, --file <file>       转换指定文件（可多个，空格分隔）
  -p, --path <dir>        指定工作目录（默认: 当前目录）
  -r, --recursive         递归搜索子目录
  -d, --depth <n>         递归深度限制（需要 -r 选项）
  -e, --extensions <ext>  指定源后缀，逗号分隔（不含点号）
  -t, --to <format>       目标格式: webp, jpg/jpeg, png, avif, tiff/tif（默认: webp）

裁剪选项（仅 crop 模式）:
  -b, --bg <r,g,b>        额外将接近该 RGB 的背景区域也裁掉（默认仅裁透明+纯白）
  --padding <n>           裁剪后四周保留的留白像素（默认 0，紧贴内容）
  --tolerance <n>         背景色容差，每个通道差值上限（默认 10）
  --white-tolerance <n>   白底容差，rgb 低于 255 的上限（默认 8）

通用:
  -h, --help              显示帮助信息
  -v, --version           显示版本信息

示例:
  cis                              # 转换当前目录的图片为 webp
  cis -f ./photo.png               # 转换单个文件
  cis -p ./images                  # 转换指定目录
  cis -r                           # 递归转换当前目录
  cis -r -d 2 -p ./images         # 递归转换，深度限制为2
  cis -e png,jpg -t jpg           # png/jpg 转换为 jpg
  cis crop -f ./big.png           # 裁剪单张图片空白到 cropped/
  cis crop -p ./images -r         # 递归裁剪目录下所有图片
  cis crop -f ./a.png --bg 245,245,245 --padding 10  # 自定义背景色+留边
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
// 空白裁剪
// ─────────────────────────────────────────

// 判断一个像素是否应被视为「空白」（可裁掉）
function isBlankPixel(r: number, g: number, b: number, a: number, opts: CliOptions): boolean {
  if (a === 0) return true; // 透明像素
  // 纯白背景（允许少量容差）
  if (r >= 255 - opts.cropWhiteTolerance && g >= 255 - opts.cropWhiteTolerance && b >= 255 - opts.cropWhiteTolerance) {
    return true;
  }
  // 自定义背景色（每个通道差值在容差内）
  if (opts.cropBg) {
    const [br, bg, bb] = opts.cropBg;
    if (Math.abs(r - br) <= opts.cropBgTolerance &&
        Math.abs(g - bg) <= opts.cropBgTolerance &&
        Math.abs(b - bb) <= opts.cropBgTolerance) {
      return true;
    }
  }
  return false;
}

async function cropImage(
  inputPath: string,
  options: CliOptions,
  _allInputFiles: string[]
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  // 裁剪模式输出到 <原目录>/cropped/，文件名保持原样（同格式）
  const dir = path.dirname(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const outputPath = path.join(dir, 'cropped', `${basename}${ext}`);
  const srcExt = ext.slice(1).toLowerCase();

  if (!SUPPORTED_INPUT_EXTENSIONS.includes(srcExt)) {
    return { success: false, outputPath, error: `不支持的图片格式: ${srcExt}` };
  }

  try {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ensureAlpha：统一 4 通道，便于判断透明像素（无 alpha 的图片会补为 255）
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    // 扫描找出内容（非空白）的包围盒
    let top = height, bottom = -1, left = width, right = -1;
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width * channels;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x * channels;
        if (!isBlankPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], options)) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          if (x < left) left = x;
          if (x > right) right = x;
        }
      }
    }

    if (top > bottom || left > right) {
      return { success: false, outputPath, error: '整张图片都是空白，无需裁剪' };
    }

    // 应用四周留白
    const p = options.cropPadding;
    const left2 = Math.max(0, left - p);
    const top2 = Math.max(0, top - p);
    const right2 = Math.min(width, right + 1 + p);
    const bottom2 = Math.min(height, bottom + 1 + p);
    const cropW = right2 - left2;
    const cropH = bottom2 - top2;

    await sharp(inputPath)
      .extract({ left: left2, top: top2, width: cropW, height: cropH })
      .toFile(outputPath);

    return { success: true, outputPath };
  } catch (err) {
    return {
      success: false,
      outputPath,
      error: err instanceof Error ? err.message : '未知错误'
    };
  }
}

// 根据模式分发到转换或裁剪
async function processImage(
  filePath: string,
  options: CliOptions,
  allInputFiles: string[]
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  if (options.mode === 'crop') {
    return cropImage(filePath, options, allInputFiles);
  }
  return convertImage(filePath, options.targetFormat, allInputFiles);
}

// ─────────────────────────────────────────
// 入口
// ─────────────────────────────────────────

async function main(): Promise<void> {
  // 裁剪子命令：剥离 'crop' 以免被当作文件/目录位置参数
  let mode: 'convert' | 'crop' = 'convert';
  if (process.argv[2] === 'crop') {
    process.argv.splice(2, 1);
    mode = 'crop';
  }

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

  const options = parseArgs();
  options.mode = mode;

  // ─── 辅助函数：处理文件列表 ───
  async function processFiles(files: string[], title: string): Promise<{ success: number; fail: number }> {
    const isCrop = options.mode === 'crop';
    console.log(`\n🖼️  change-image-suffix - ${isCrop ? '空白裁剪工具' : title}\n`);
    if (isCrop) {
      console.log(`✂️  模式: 裁剪四周空白 → cropped/`);
      console.log(`📐 留白: ${options.cropPadding}px` + (options.cropBg ? `，背景色: ${options.cropBg.join(',')}` : '，背景: 透明+纯白'));
    } else {
      console.log(`🎯 目标格式: ${options.targetFormat}`);
    }
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
      const result = await processImage(filePath, options, files);

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
    const isCrop = options.mode === 'crop';
    if (isCrop) {
      console.log(`\n✂️  change-image-suffix - 空白裁剪工具`);
      console.log(`📐 留白: ${options.cropPadding}px` + (options.cropBg ? `，背景色: ${options.cropBg.join(',')}` : '，背景: 透明+纯白'));
    } else {
      console.log(`\n🎯 目标格式: ${options.targetFormat}`);
    }
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
        const result = await processImage(inputPath, options, dirs);
        if (result.success) {
          console.log(`✅ -> ${path.relative(path.dirname(inputPath), result.outputPath)}`);
          totalSuccess++;
        } else {
          console.log(`❌ 失败 (${result.error})`);
          totalFail++;
          failures.push(inputPath);
        }
      } else {
        const files = getAllFiles(inputPath, options.extensions, options.recursive, 0, options.maxDepth, options.mode === 'crop' ? 'cropped' : options.targetFormat);
        console.log(`  📁 目录: ${inputPath} (${files.length} 个文件)`);

        if (files.length === 0) {
          console.log('     ✅ 没有找到图片文件');
          continue;
        }

        for (const file of files) {
          process.stdout.write(`     处理中: ${path.basename(file)} ... `);
          const result = await processImage(file, options, files);
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
    console.log(`\n🖼️  change-image-suffix - ${options.mode === 'crop' ? '批量裁剪工具' : '批量转换工具'}\n`);
    const result = await processDirs(options.multiPaths);
    totalFail = result.fail;
    console.log('\n----------------------------------------');
    console.log(`📊 转换完成！成功: ${result.success}, 失败: ${result.fail}\n`);
  } else {
    // ─── 目录批量模式 ───
    const isCrop = options.mode === 'crop';
    const excludeName = isCrop ? 'cropped' : options.targetFormat;
    console.log(`📂 目录: ${options.directory}`);
    console.log(`🔁 递归: ${options.recursive ? `是 (深度: ${options.maxDepth === Infinity ? '无限制' : options.maxDepth})` : '否'}`);
    console.log(`📄 后缀: ${options.extensions.join(', ')}`);
    if (isCrop) {
      console.log(`✂️  模式: 裁剪四周空白 → cropped/` + (options.cropBg ? `，背景色: ${options.cropBg.join(',')}` : '，背景: 透明+纯白') + `，留白: ${options.cropPadding}px`);
    } else {
      console.log(`🎯 目标格式: ${options.targetFormat}`);
    }
    console.log('\n----------------------------------------\n');

    const files = getAllFiles(options.directory, options.extensions, options.recursive, 0, options.maxDepth, excludeName);

    if (files.length === 0) {
      console.log(`✅ 没有找到需要${isCrop ? '裁剪' : '转换'}的图片文件。`);
    } else {
      console.log(`📋 找到 ${files.length} 个文件，准备开始${isCrop ? '裁剪' : '转换'}...\n`);

      let successCount = 0;
      let failCount = 0;
      const results: { input: string; output: string; status: 'success' | 'fail' }[] = [];

      for (const file of files) {
        const relativePath = path.relative(options.directory, file);
        process.stdout.write(`  处理中: ${relativePath} ... `);

        const result = await processImage(file, options, files);

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
