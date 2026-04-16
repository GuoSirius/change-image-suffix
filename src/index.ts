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

  // Windows cmd 运行 .cmd 脚本需要用 cmd /c
  const runner = `cmd.exe /c "${cisCmd}" -p "%V" & pause`;

  // ── 1. 目录空白处右键（Directory\Background）──
  const bgBase = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis';
  regAddDefault(bgBase, '🖼 转换图片为 WebP (cis)');
  regAdd(bgBase, 'Icon', cisCmd);
  const bgCmd = bgBase + '\\command';
  regAddDefault(bgCmd, runner);

  // ── 2. 目录本身右键（Directory）──
  const dirBase = 'HKCU\\Software\\Classes\\Directory\\shell\\cis';
  regAddDefault(dirBase, '🖼 转换图片为 WebP (cis)');
  regAdd(dirBase, 'Icon', cisCmd);
  const dirCmd = dirBase + '\\command';
  regAddDefault(dirCmd, `cmd.exe /c "${cisCmd}" -p "%1" & pause`);

  console.log('✅ 右键菜单安装成功！');
  console.log('   在任意文件夹空白处或文件夹上右键，即可看到「🖼 转换图片为 WebP (cis)」');
  console.log('\n💡 提示：如需卸载，执行 cis uninstall-menu');
}

function uninstallContextMenu(): void {
  requireWindows();
  regDelete('HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis');
  regDelete('HKCU\\Software\\Classes\\Directory\\shell\\cis');
  console.log('✅ 右键菜单已卸载');
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
      console.log('change-image-suffix v1.1.0');
      process.exit(0);
    }

    if (arg === '-p' || arg === '--path') {
      if (i + 1 < args.length) {
        directory = path.resolve(args[++i]);
      }
      continue;
    }

    if (!arg.startsWith('-')) {
      directory = path.resolve(arg);
    }
  }

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
  -p, --path <dir>        指定工作目录（默认: 当前目录）
  -r, --recursive         递归搜索子目录
  -d, --depth <n>         递归深度限制（需要 -r 选项）
  -e, --extensions <ext>  指定要转换的后缀，逗号分隔（不含点号）
  -t, --to <format>       转换到的目标格式（默认: webp）
  -h, --help              显示帮助信息
  -v, --version           显示版本信息

示例:
  cis                              # 转换当前目录的图片为 webp
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

function generateNewFilename(originalPath: string, targetFormat: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const basename = path.basename(originalPath, ext);
  const originalExt = ext.slice(1).toLowerCase();

  if (originalExt === targetFormat) {
    return path.join(dir, `${basename}.${originalExt}.${targetFormat}`);
  }
  return path.join(dir, `${basename}.${targetFormat}`);
}

function ensureUniqueFilename(filepath: string): string {
  if (!fs.existsSync(filepath)) return filepath;

  const dir = path.dirname(filepath);
  const ext = path.extname(filepath);
  const basename = path.basename(filepath, ext);

  let counter = 1;
  let newPath = filepath;

  while (fs.existsSync(newPath)) {
    newPath = path.join(dir, `${basename}_${counter}${ext}`);
    counter++;
  }

  return newPath;
}

async function convertImage(
  inputPath: string,
  targetFormat: string
): Promise<{ success: boolean; outputPath: string; error?: string }> {
  try {
    const outputPath = generateNewFilename(inputPath, targetFormat);
    const uniqueOutputPath = ensureUniqueFilename(outputPath);

    const image = sharp(inputPath);

    switch (targetFormat.toLowerCase()) {
      case 'webp': await image.webp({ quality: 85 }).toFile(uniqueOutputPath); break;
      case 'jpg':
      case 'jpeg': await image.jpeg({ quality: 85 }).toFile(uniqueOutputPath); break;
      case 'png':  await image.png({ quality: 85 }).toFile(uniqueOutputPath); break;
      case 'gif':  await image.gif().toFile(uniqueOutputPath); break;
      case 'tiff':
      case 'tif':  await image.tiff({ quality: 85 }).toFile(uniqueOutputPath); break;
      case 'avif': await image.avif({ quality: 85 }).toFile(uniqueOutputPath); break;
      default:     await image.toFormat(targetFormat as any).toFile(uniqueOutputPath);
    }

    return { success: true, outputPath: uniqueOutputPath };
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

    const result = await convertImage(file, options.targetFormat);

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
