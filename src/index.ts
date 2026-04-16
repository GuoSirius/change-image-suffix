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

  // ── 格式列表（webp 排第一，其他按常见程度排序）──
  const formats = [
    { verb: 'webp', label: '🌀 WebP' },
    { verb: 'png', label: '🖼 PNG' },
    { verb: 'jpg', label: '📷 JPG' },
    { verb: 'avif', label: '📺 AVIF' },
    { verb: 'gif', label: '🎞 GIF' },
    { verb: 'tiff', label: '📋 TIFF' },
    { verb: 'heif', label: '🍎 HEIF' },
    { verb: 'jp2', label: '📐 JPEG2000' },
  ];

  // ── 使用 ExtendedSubCommandsKey 方式（PowerShell 7 同款）──
  // 主菜单项配置（每个菜单类型有独立的子菜单路径）
  const menuBases = [
    { base: 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis', arg: '-p "%V"' },
    { base: 'HKCU\\Software\\Classes\\Directory\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_dir', arg: '-p "%1"' },
    { base: 'HKCU\\Software\\Classes\\*\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_file', arg: '-f %*', isFile: true },
  ];

  // 1. 注册公共子菜单（每种菜单类型独立注册）
  const REG_ROOT = 'HKCU\\Software\\Classes\\';
  for (const menu of menuBases) {
    for (const fmt of formats) {
      const shellKey = `${REG_ROOT}${menu.subMenu}\\shell\\${fmt.verb}`;
      const cmd = `"${cisCmd}" -t ${fmt.verb} ${menu.arg}`;
      execSync(`reg add "${shellKey}" /ve /d "${fmt.label}" /f`, { stdio: 'ignore' });
      execSync(`reg add "${shellKey}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
      execSync(`reg add "${shellKey}\\command" /ve /d "cmd /c ${cmd}" /f`, { stdio: 'ignore' });
    }
  }

  // 2. 注册主菜单项（使用 ExtendedSubCommandsKey 关联各自的子菜单）
  for (const menu of menuBases) {
    execSync(`reg add "${menu.base}" /ve /d "🖼 转换图片 (cis)" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v ExtendedSubCommandsKey /d "${menu.subMenu}" /f`, { stdio: 'ignore' });

    // 文件右键添加 AppliesTo 限制
    if ((menu as any).isFile) {
      const appliesTo = 'System.FileName:*.png OR System.FileName:*.jpg OR System.FileName:*.jpeg OR System.FileName:*.gif OR System.FileName:*.bmp OR System.FileName:*.tiff OR System.FileName:*.tif OR System.FileName:*.webp OR System.FileName:*.avif';
      execSync(`reg add "${menu.base}" /v AppliesTo /d "${appliesTo}" /f`, { stdio: 'ignore' });
    }
  }

  console.log('✅ 右键菜单安装成功！');
  console.log('   📁 文件夹空白处/图标右键 → 悬停展开格式子菜单');
  console.log('   🖼  图片文件上右键       → 悬停展开格式子菜单');
  console.log(`   📂 输出目录: <原目录>/output/`);
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

  console.log('✅ 右键菜单已卸载');
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

  // 用于暂存多路径收集
  let pendingPaths: string[] = [];
  let firstPathType: 'file' | 'dir' | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-r' || arg === '--recursive') { options.recursive = true; continue; }

    if (arg === '-d' || arg === '--depth') {
      if (i + 1 < args.length) {
        options.maxDepth = parseInt(args[++i], 10);
        if (isNaN(options.maxDepth) || options.maxDepth < 1) {
          console.error('❌ 深度必须是正整数');
          process.exit(1);
        }
      }
      continue;
    }

    if (arg === '-e' || arg === '--extensions') {
      if (i + 1 < args.length) {
        options.extensions = args[++i].split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
      }
      continue;
    }

    if (arg === '-t' || arg === '--to') {
      if (i + 1 < args.length) {
        options.targetFormat = args[++i].trim().toLowerCase().replace(/^\./, '');
      }
      continue;
    }

    if (arg === '-h' || arg === '--help') { printHelp(); process.exit(0); }

    if (arg === '-v' || arg === '--version') {
      console.log('change-image-suffix v1.15.0');
      process.exit(0);
    }

    if (arg === '-p' || arg === '--path') {
      if (i + 1 < args.length) {
        options.directory = path.resolve(args[++i]);
      }
      continue;
    }

    if (arg === '-f' || arg === '--file') {
      // 收集所有后续非选项参数作为文件列表
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const filePath = path.resolve(args[++i]);
        if (!options.multiFiles) {
          options.multiFiles = [];
        }
        options.multiFiles.push(filePath);
      }
      continue;
    }

    if (!arg.startsWith('-')) {
      // 位置参数：全部收集为路径
      pendingPaths.push(path.resolve(arg));
    }
  }

  // 处理收集到的路径
  if (pendingPaths.length > 0) {
    if (pendingPaths.length === 1) {
      // 只有一个路径
      const p = pendingPaths[0];
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        options.singleFile = p;
      } else {
        options.directory = p;
      }
    } else {
      // 多个路径 → 多路径模式
      options.multiPaths = pendingPaths;
    }
  }

  // 验证单/多文件模式
  if (options.multiFiles && options.multiFiles.length > 0) {
    for (const f of options.multiFiles) {
      if (!fs.existsSync(f)) {
        console.error(`❌ 文件不存在: ${f}`);
        process.exit(1);
      }
      if (!fs.statSync(f).isFile()) {
        console.error(`❌ 路径不是文件: ${f}`);
        process.exit(1);
      }
    }
    return options;
  }

  // 验证目录模式（单目录或多路径）
  if (!options.multiPaths) {
    if (!fs.existsSync(options.directory)) {
      console.error(`❌ 目录不存在: ${options.directory}`);
      process.exit(1);
    }
    if (!fs.statSync(options.directory).isDirectory()) {
      console.error(`❌ 路径不是目录: ${options.directory}`);
      process.exit(1);
    }
  }

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

  // 源格式与目标格式相同时，直接覆盖
  let coreName = basename;

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

  // ─── 单/多文件模式 ───
  if (options.multiFiles && options.multiFiles.length > 0) {
    const files = options.multiFiles;
    console.log(`\n🖼️  change-image-suffix - 图片转换工具\n`);
    console.log(`🎯 目标格式: ${options.targetFormat}`);
    console.log(`📦 待处理: ${files.length} 个文件\n`);
    console.log('----------------------------------------\n');

    const supportedExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'avif'];
    let totalSuccess = 0;
    let totalFail = 0;

    for (const filePath of files) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!supportedExts.includes(ext)) {
        console.log(`  ⚠️  跳过（不支持格式）: ${filePath}`);
        totalFail++;
        continue;
      }

      console.log(`  📄 文件: ${filePath}`);
      process.stdout.write(`     处理中: ${path.basename(filePath)} ... `);
      const result = await convertImage(filePath, options.targetFormat, [filePath]);

      if (result.success) {
        console.log(`✅ -> ${path.relative(path.dirname(filePath), result.outputPath)}`);
        totalSuccess++;
      } else {
        console.log(`❌ 失败 (${result.error})`);
        totalFail++;
      }
    }

    console.log('\n----------------------------------------\n');
    console.log(`📊 转换完成！成功: ${totalSuccess}, 失败: ${totalFail}\n`);
    return;
  }

  // ─── 多路径模式 ───
  if (options.multiPaths) {
    console.log(`\n🖼️  change-image-suffix - 批量转换工具\n`);
    console.log(`🎯 目标格式: ${options.targetFormat}`);
    console.log(`📦 待处理: ${options.multiPaths.length} 个路径\n`);
    console.log('----------------------------------------\n');

    let totalSuccess = 0;
    let totalFail = 0;

    for (const inputPath of options.multiPaths) {
      const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;

      if (!stat) {
        console.log(`  ⚠️  跳过（不存在）: ${inputPath}`);
        totalFail++;
        continue;
      }

      if (stat.isFile()) {
        // 文件：输出到其所在目录的 output/
        const ext = path.extname(inputPath).slice(1).toLowerCase();
        const supportedExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'avif'];
        if (!supportedExts.includes(ext)) {
          console.log(`  ⚠️  跳过（不支持格式）: ${inputPath}`);
          totalFail++;
          continue;
        }

        console.log(`  📄 文件: ${inputPath}`);
        process.stdout.write(`     处理中: ${path.basename(inputPath)} ... `);
        const result = await convertImage(inputPath, options.targetFormat, [inputPath]);
        if (result.success) {
          console.log(`✅ -> ${path.relative(path.dirname(inputPath), result.outputPath)}`);
          totalSuccess++;
        } else {
          console.log(`❌ 失败 (${result.error})`);
          totalFail++;
        }
      } else {
        // 目录：输出到该目录的 output/
        const files = getAllFiles(inputPath, options.extensions, options.recursive, 0, options.maxDepth);
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
          }
        }
      }
      console.log('');
    }

    console.log('----------------------------------------');
    console.log(`\n📊 转换完成！成功: ${totalSuccess}, 失败: ${totalFail}\n`);
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
