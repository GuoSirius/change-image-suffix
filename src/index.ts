#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
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

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  
  let directory = process.cwd();
  let recursive = false;
  let maxDepth = Infinity;
  let extensions: string[] = DEFAULT_EXTENSIONS;
  let targetFormat = DEFAULT_TARGET_FORMAT;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // 递归标志
    if (arg === '-r' || arg === '--recursive') {
      recursive = true;
      continue;
    }
    
    // 深度限制
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
    
    // 指定后缀
    if (arg === '-e' || arg === '--extensions') {
      if (i + 1 < args.length) {
        extensions = args[++i].split(',').map(e => e.trim().toLowerCase().replace(/^\./, ''));
      }
      continue;
    }
    
    // 目标格式
    if (arg === '-t' || arg === '--to') {
      if (i + 1 < args.length) {
        targetFormat = args[++i].trim().toLowerCase().replace(/^\./, '');
      }
      continue;
    }
    
    // 帮助信息
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    
    // 版本信息
    if (arg === '-v' || arg === '--version') {
      console.log('change-image-suffix v1.0.0');
      process.exit(0);
    }
    
    // 指定目录
    if (arg === '-p' || arg === '--path') {
      if (i + 1 < args.length) {
        directory = path.resolve(args[++i]);
      }
      continue;
    }
    
    // 目录路径（位置参数）
    if (!arg.startsWith('-')) {
      directory = path.resolve(arg);
    }
  }
  
  // 验证目录
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

选项:
  -p, --path <dir>        指定工作目录（默认: 当前目录）
  -r, --recursive         递归搜索子目录
  -d, --depth <n>         递归深度限制（需要 -r 选项）
  -e, --extensions <ext>  指定要转换的后缀，逗号分隔（不含点号）
  -t, --to <format>       转换到的目标格式（默认: webp）
  -h, --help              显示帮助信息
  -v, --version           显示版本信息

示例:
  change-image-suffix                        # 转换当前目录的图片为 webp
  change-image-suffix -p ./images             # 转换指定目录
  change-image-suffix -r                      # 递归转换当前目录
  change-image-suffix -r -d 2 -p ./images     # 递归转换，深度限制为2
  change-image-suffix -e png,jpg -t jpg       # png/jpg 转换为 jpg
`);
}

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
        // 递归处理子目录
        const subFiles = getAllFiles(fullPath, extensions, recursive, currentDepth + 1, maxDepth);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️  无法读取目录: ${dir}`);
  }
  
  return files;
}

function generateNewFilename(originalPath: string, targetFormat: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const basename = path.basename(originalPath, ext);
  const originalExt = ext.slice(1).toLowerCase();
  
  // 如果目标格式与原格式相同，需要添加原后缀
  if (originalExt === targetFormat) {
    return path.join(dir, `${basename}.${originalExt}.${targetFormat}`);
  }
  
  // 否则直接替换扩展名
  return path.join(dir, `${basename}.${targetFormat}`);
}

function ensureUniqueFilename(filepath: string): string {
  if (!fs.existsSync(filepath)) {
    return filepath;
  }
  
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
    
    // 根据目标格式设置输出选项
    switch (targetFormat.toLowerCase()) {
      case 'webp':
        await image.webp({ quality: 85 }).toFile(uniqueOutputPath);
        break;
      case 'jpg':
      case 'jpeg':
        await image.jpeg({ quality: 85 }).toFile(uniqueOutputPath);
        break;
      case 'png':
        await image.png({ quality: 85 }).toFile(uniqueOutputPath);
        break;
      case 'gif':
        await image.gif().toFile(uniqueOutputPath);
        break;
      case 'tiff':
      case 'tif':
        await image.tiff({ quality: 85 }).toFile(uniqueOutputPath);
        break;
      case 'avif':
        await image.avif({ quality: 85 }).toFile(uniqueOutputPath);
        break;
      default:
        // 对于其他格式，尝试直接转换
        await image.toFormat(targetFormat as any).toFile(uniqueOutputPath);
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

async function main(): Promise<void> {
  console.log('\n🖼️  change-image-suffix - 图片格式批量转换工具\n');
  
  const options = parseArgs();
  
  console.log(`📂 目录: ${options.directory}`);
  console.log(`🔁 递归: ${options.recursive ? `是 (深度: ${options.maxDepth === Infinity ? '无限制' : options.maxDepth})` : '否'}`);
  console.log(`📄 后缀: ${options.extensions.join(', ')}`);
  console.log(`🎯 目标格式: ${options.targetFormat}`);
  console.log('\n----------------------------------------\n');
  
  // 获取所有符合条件的文件
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
  
  // 如果有失败的文件，列出它们
  if (failCount > 0) {
    console.log('❌ 失败的文件:');
    for (const r of results.filter(x => x.status === 'fail')) {
      console.log(`   - ${r.input}`);
    }
  }
}

// 运行
main().catch(console.error);
