# change-image-suffix

批量转换图片格式的 CLI 工具，支持递归搜索、深度限制、指定后缀等功能。

## 功能特性

- 📁 支持指定目录或使用当前目录
- 🔄 支持递归搜索子目录
- 📏 支持递归深度限制
- 🎯 支持指定源文件后缀（png, jpg, gif 等）
- 🎨 支持多种目标格式（webp, jpg, png, gif, tiff, avif）
- ⏭️ 自动跳过同名文件或添加序号避免冲突
- 🖼️ 别名 `cis` 方便快速调用

## 安装

```bash
# 使用 npm 安装到全局
npm install -g change-image-suffix

# 或使用 yarn
yarn global add change-image-suffix
```

## 使用方法

```bash
# 基本用法 - 转换当前目录的图片为 webp
change-image-suffix

# 或使用简写
cis

# 指定目录
change-image-suffix -p ./images
cis -p ./images

# 递归转换
change-image-suffix -r
cis -r

# 递归并限制深度
change-image-suffix -r -d 2
cis -r -d 2

# 指定后缀
change-image-suffix -e png,jpg

# 指定目标格式
change-image-suffix -t jpg
cis -t png

# 组合使用
change-image-suffix -r -d 3 -p ./images -e png,jpg -t webp
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <dir>` | 指定工作目录 | 当前目录 |
| `-r, --recursive` | 递归搜索子目录 | 否 |
| `-d, --depth <n>` | 递归深度限制 | 无限制 |
| `-e, --extensions <ext>` | 指定后缀，逗号分隔 | png,jpg,jpeg,gif,bmp,tiff,webp |
| `-t, --to <format>` | 目标格式 | webp |
| `-h, --help` | 显示帮助 | - |
| `-v, --version` | 显示版本 | - |

## 支持的格式

**输入格式**: png, jpg, jpeg, gif, bmp, tiff, webp, avif, tif

**输出格式**: webp, jpg, jpeg, png, gif, tiff, tif, avif

## 文件名冲突处理

- **格式不同时**: 直接替换扩展名，如 `photo.jpg` → `photo.webp`
- **格式相同时**: 保留原名+原后缀，如 `photo.png` → `photo.png.png`
- **同名冲突**: 自动添加序号，如 `photo.webp` → `photo_1.webp`

## 开发

```bash
# 克隆项目
git clone https://gitee.com/siriussupreme/change-image-suffix.git
cd change-image-suffix

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 链接到全局
npm link

# 取消链接
npm unlink
```

## 技术栈

- TypeScript
- [sharp](https://sharp.pixel.glass/) - 高性能图片处理

## License

MIT
