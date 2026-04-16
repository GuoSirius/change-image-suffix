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

  // ── 查找 cis.cmd 和 node_modules 路径 ──
  let cisCmd = '';
  let nodeModulesDir = '';
  try {
    cisCmd = execSync('where cis.cmd', { encoding: 'utf8' }).trim().split('\n')[0].trim();
    nodeModulesDir = path.dirname(cisCmd);
  } catch {
    try {
      cisCmd = execSync('where cis', { encoding: 'utf8' }).trim().split('\n')[0].trim();
      nodeModulesDir = path.dirname(cisCmd);
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

  // ── 辅助脚本路径定义（需要在 batContent 之前，因为 bat 中引用了 ps1Path）──
  const batPath = path.join(appDataDir, 'cis_file.bat');
  const ps1Path = path.join(appDataDir, 'cis_getfiles.ps1');

  // cis_getfiles.ps1: 通过 Shell.Application COM 获取 Explorer 选中文件
  const cisGetfilesContent = `
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName UIAutomationClient
$files = @()
try {
    $shell = New-Object -ComObject Shell.Application
    $windows = $shell.Windows()
    foreach ($win in $windows) {
        if ($win -and $win.FullName -like "*explorer.exe") {
            $selected = $win.Document.SelectedItems()
            foreach ($item in $selected) {
                if ($item -and $item.Path) {
                    $files += $item.Path
                }
            }
        }
    }
} catch {}
if ($files.Count -gt 0) {
    $files | ForEach-Object { $_ }
} else {
    Write-Output "NO_FILES"
}
`;
  fs.writeFileSync(ps1Path, cisGetfilesContent, 'utf8');

  // ── bat 脚本：接收 Windows 传递的文件路径和格式参数 ──
  // 根据 Windows ExtendedSubCommandsKey 机制：
  // - 子命令的 command 参数（格式）在前
  // - Windows 自动将父命令收到的文件路径追加在末尾
  // - 最终执行: cmd /c "bat" "格式" "文件路径"
  // 移除 AppliesTo 限制后，bat 需要过滤非图片文件
  const batContent = `
@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM Get this script's directory (no trailing backslash)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=!SCRIPT_DIR:~0,-1!"

REM Get cis.cmd path
for /f "delims=" %%c in ('where cis.cmd 2^>nul') do set "CIS_CMD=%%c"

REM Supported image extensions
set "SUPPORTED_EXT=.png;.jpg;.jpeg;.gif;.bmp;.tiff;.tif;.webp;.avif"

REM %1 = format (from subcommand), %2 = file path (from Windows)
if "%~1"=="" (
    echo Error: No format specified.
    timeout /t 2 >nul
    goto :done
)
set "format=%~1"

REM Collect all image files
set "fileList="

REM Windows passes file path as %2. If multiple files selected, use PowerShell.
REM Otherwise use direct argument.
if "%~2"=="" (
    REM Multi-file via PowerShell (with retries for reliability)
    for /f "delims=" %%i in ('powershell -ExecutionPolicy Bypass -File "!SCRIPT_DIR!\\cis_getfiles.ps1"') do (
        if not "%%i"=="NO_FILES" (
            call :add_if_image "%%i"
        )
    )
) else (
    REM Single file or multiple via %2 (space-separated)
    REM Split space-separated paths
    for %%F in (%~2) do (
        call :add_if_image "%%F"
    )
)

REM Process all collected files - use start /b to avoid new window
if not "!fileList!"=="" (
    start "" /b cmd /c "!CIS_CMD! -t !format! !fileList!"
)
goto :done

:add_if_image
set "filePath=%~1"
REM Skip if empty or NO_FILES
if "!filePath!"=="" exit /b
if "!filePath!"=="NO_FILES" exit /b

REM Get file extension
for %%E in ("!filePath!") do set "ext=%%~xE"
if "!ext!"=="" exit /b

REM Convert to lowercase
set "ext_lower=!ext!"
call set "ext_lower=%%ext_lower:A=a%%
call set "ext_lower=%%ext_lower:B=b%%
call set "ext_lower=%%ext_lower:C=c%%
call set "ext_lower=%%ext_lower:D=d%%
call set "ext_lower=%%ext_lower:E=e%%
call set "ext_lower=%%ext_lower:F=f%%
call set "ext_lower=%%ext_lower:G=g%%
call set "ext_lower=%%ext_lower:H=h%%
call set "ext_lower=%%ext_lower:I=i%%
call set "ext_lower=%%ext_lower:J=j%%
call set "ext_lower=%%ext_lower:K=k%%
call set "ext_lower=%%ext_lower:L=l%%
call set "ext_lower=%%ext_lower:M=m%%
call set "ext_lower=%%ext_lower:N=n%%
call set "ext_lower=%%ext_lower:O=o%%
call set "ext_lower=%%ext_lower:P=p%%
call set "ext_lower=%%ext_lower:Q=q%%
call set "ext_lower=%%ext_lower:R=r%%
call set "ext_lower=%%ext_lower:S=s%%
call set "ext_lower=%%ext_lower:T=t%%
call set "ext_lower=%%ext_lower:U=u%%
call set "ext_lower=%%ext_lower:V=v%%
call set "ext_lower=%%ext_lower:W=w%%
call set "ext_lower=%%ext_lower:X=x%%
call set "ext_lower=%%ext_lower:Y=y%%
call set "ext_lower=%%ext_lower:Z=z%%"

REM Check if extension is supported
echo !SUPPORTED_EXT! | findstr /i /c:"!ext_lower!" >nul 2>&1
if !errorlevel!==0 (
    set "fileList=!fileList! -f "!filePath!""
)
exit /b

:done
endlocal
exit

exit

exit

exit

`;
  fs.writeFileSync(batPath, batContent, 'utf8');

  // ── 格式列表（webp 排第一，其他按常见程度排序）──
  const formats = [
    { verb: 'webp', label: '🌀 WebP' },
    { verb: 'jpg', label: '📷 JPG' },
    { verb: 'png', label: '🖼 PNG' },
    { verb: 'avif', label: '📺 AVIF' },
    { verb: 'gif', label: '🎞 GIF' },
    { verb: 'tiff', label: '📋 TIFF' },
    { verb: 'heif', label: '🍎 HEIF' },
    { verb: 'jp2', label: '📐 JPEG2000' },
  ];

  // ── 使用 ExtendedSubCommandsKey 方式（PowerShell 7 同款）──
  // 主菜单项配置（每个菜单类型有独立的子菜单路径）
  // 注意：文件右键和目录右键都使用 bat + PowerShell 获取选中文件
  // 这样混合选择时也能处理所有选中项
  const menuBases = [
    { base: 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis', arg: '-p "%V"' },
    { base: 'HKCU\\Software\\Classes\\Directory\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_dir', useBat: true },
    { base: 'HKCU\\Software\\Classes\\*\\shell\\cis', subMenu: 'Directory\\ContextMenus\\cis_file', useBat: true },
  ];

  // 1. 注册公共子菜单（每种菜单类型独立注册）
  const REG_ROOT = 'HKCU\\Software\\Classes\\';
  for (const menu of menuBases) {
    for (const fmt of formats) {
      const shellKey = `${REG_ROOT}${menu.subMenu}\\shell\\${fmt.verb}`;
      let cmd: string;
      if ((menu as any).useBat) {
        // 文件右键：子命令传递格式参数，Windows 自动追加文件路径
        // 最终执行: cmd /c "bat" "格式" "文件路径"
        cmd = `"${batPath}" ${fmt.verb}`;
      } else {
        cmd = `"${cisCmd}" -t ${fmt.verb} ${menu.arg}`;
      }
      execSync(`reg add "${shellKey}" /ve /d "${fmt.label}" /f`, { stdio: 'ignore' });
      execSync(`reg add "${shellKey}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
      // 直接调用 bat，不需要 cmd /c，Windows 会自动追加文件路径
      execSync(`reg add "${shellKey}\\command" /ve /d "${cmd}" /f`, { stdio: 'ignore' });
    }
  }

  // 2. 注册主菜单项（使用 ExtendedSubCommandsKey 关联各自的子菜单）
  for (const menu of menuBases) {
    execSync(`reg add "${menu.base}" /ve /d "🖼 转换图片 (cis)" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v Icon /d "${iconPath}" /f`, { stdio: 'ignore' });
    execSync(`reg add "${menu.base}" /v ExtendedSubCommandsKey /d "${menu.subMenu}" /f`, { stdio: 'ignore' });

    // 使用 bat 的菜单（文件右键和目录右键）：设置 command 接收文件路径 %1
    // Windows 会将父命令收到的 %1 自动传递给子命令
    if ((menu as any).useBat) {
      execSync(`reg add "${menu.base}\\command" /ve /d "cmd /c echo %1 > nul" /f`, { stdio: 'ignore' });
      // 注意：不添加 AppliesTo 限制，让菜单始终显示
      // bat 脚本会检查文件扩展名，自动忽略非图片文件
    }
  }

  console.log('✅ 右键菜单安装成功！');
  console.log('   📁 文件夹空白处/图标右键 → 悬停展开格式子菜单');
  console.log('   🖼  图片文件上右键       → 悬停展开格式子菜单');
  console.log('   ⚠️  非图片文件右键       → 菜单显示但不处理');
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

  // 删除批处理文件和 PowerShell 脚本
  const appDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'change-image-suffix');
  const batPath = path.join(appDataDir, 'cis_file.bat');
  const ps1Path = path.join(appDataDir, 'cis_getfiles.ps1');
  try { fs.unlinkSync(batPath); } catch { /* ignore */ }
  try { fs.unlinkSync(ps1Path); } catch { /* ignore */ }

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
      if (i + 1 < args.length) {
        options.maxDepth = parseInt(args[++i], 10);
        if (isNaN(options.maxDepth) || options.maxDepth < 1) {
          console.error('❌ 深度必须是正整数');
          process.exit(1);
        }
      }
      i++;
      continue;
    }

    if (arg === '-e' || arg === '--extensions') {
      if (i + 1 < args.length) {
        options.extensions = args[++i].split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
      }
      i++;
      continue;
    }

    if (arg === '-t' || arg === '--to') {
      if (i + 1 < args.length) {
        options.targetFormat = args[++i].trim().toLowerCase().replace(/^\./, '');
      }
      i++;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg === '-v' || arg === '--version') {
      console.log('change-image-suffix v1.18.0');
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
      while (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++;
        filesFromFlag.push(path.resolve(args[i]));
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

  // ─── 辅助函数：处理文件列表 ───
  async function processFiles(files: string[], title: string): Promise<{ success: number; fail: number }> {
    console.log(`\n🖼️  change-image-suffix - ${title}\n`);
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

    return { success: totalSuccess, fail: totalFail };
  }

  // ─── 辅助函数：处理目录列表 ───
  async function processDirs(dirs: string[]): Promise<{ success: number; fail: number }> {
    console.log(`\n🎯 目标格式: ${options.targetFormat}`);
    console.log(`📦 待处理: ${dirs.length} 个目录\n`);
    console.log('----------------------------------------\n');

    let totalSuccess = 0;
    let totalFail = 0;

    for (const inputPath of dirs) {
      const stat = fs.existsSync(inputPath) ? fs.statSync(inputPath) : null;

      if (!stat) {
        console.log(`  ⚠️  跳过（不存在）: ${inputPath}`);
        totalFail++;
        continue;
      }

      if (stat.isFile()) {
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
    }

    return { success: totalSuccess, fail: totalFail };
  }

  // ─── 混合模式：同时有文件和目录 ───
  if (options.multiFiles && options.multiFiles.length > 0 && options.multiPaths && options.multiPaths.length > 0) {
    console.log('\n🖼️  change-image-suffix - 混合模式（文件+目录）\n');
    const fileResult = await processFiles(options.multiFiles, '图片转换工具');
    console.log('\n');
    const dirResult = await processDirs(options.multiPaths);
    console.log('\n----------------------------------------');
    console.log(`📊 转换完成！成功: ${fileResult.success + dirResult.success}, 失败: ${fileResult.fail + dirResult.fail}\n`);
    return;
  }

  // ─── 单/多文件模式 ───
  if (options.multiFiles && options.multiFiles.length > 0) {
    const result = await processFiles(options.multiFiles, '图片转换工具');
    console.log('\n----------------------------------------\n');
    console.log(`📊 转换完成！成功: ${result.success}, 失败: ${result.fail}\n`);
    return;
  }

  // ─── 多路径模式 ───
  if (options.multiPaths) {
    console.log(`\n🖼️  change-image-suffix - 批量转换工具\n`);
    const result = await processDirs(options.multiPaths);
    console.log('\n----------------------------------------');
    console.log(`📊 转换完成！成功: ${result.success}, 失败: ${result.fail}\n`);
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
