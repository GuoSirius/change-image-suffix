# change-image-suffix

🖼️ 批量转换图片格式的 CLI 工具，支持递归搜索、深度限制、Windows 右键菜单等功能。

## 功能特性

- 📁 支持指定目录或使用当前目录
- 🔄 支持递归搜索子目录
- 📏 支持递归深度限制
- 🎯 支持指定源文件后缀（png, jpg, gif 等）
- 🎨 支持多种目标格式（webp, jpg, png, avif, gif）
- 📤 输出到 `output/` 子目录
- 🔢 同名不同后缀文件自动编号（`_01`, `_02`）
- 🖱️ Windows 右键菜单集成
- ⚡ 基于 [sharp](https://sharp.pixel.glass/) 高性能图片处理

---

## 快速开始

```bash
# 安装
npm install -g change-image-suffix

# 基本用法（转换当前目录图片为 webp）
cis

# 指定目录
cis -p ./images

# 递归转换
cis -r
```

---

## 常用命令

| 场景 | 命令 |
|------|------|
| 转换当前目录 → webp | `cis` |
| 转换指定目录 → webp | `cis -p ./photos` |
| 递归转换所有子目录 | `cis -r` |
| 递归，限制深度 2 层 | `cis -r -d 2` |
| 仅转换 png 和 jpg | `cis -e png,jpg` |
| 转换为 jpg 格式 | `cis -t jpg` |
| 转换为 avif（更小体积） | `cis -t avif` |
| 单个文件转换 | `cis -f ./banner.png` |
| 显示帮助 | `cis --help` |

### Windows 右键菜单

```bash
# 注册右键菜单（只需执行一次）
cis install-menu

# 卸载右键菜单
cis uninstall-menu
```

注册后，在文件夹或图片文件上**右键**即可看到：
- 🌀 **转换为 WebP**（点击即执行）
- 📷 **转换为 JPG**
- 🖼️ **转换为 PNG**
- 📺 **转换为 AVIF**
- 🎞️ **转换为 GIF**

---

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-p, --path <dir>` | 指定工作目录 | 当前目录 |
| `-r, --recursive` | 递归搜索子目录 | 否 |
| `-d, --depth <n>` | 递归深度限制 | 无限制 |
| `-e, --extensions` | 指定源后缀，逗号分隔 | png,jpg,jpeg,gif,bmp,tiff,webp |
| `-t, --to <format>` | 目标格式 | webp |
| `-f, --file <file>` | 指定单个文件转换 | - |
| `-h, --help` | 显示帮助 | - |
| `-v, --version` | 显示版本 | - |

---

## 文件命名规范

转换后的文件输出到 **`output/`** 子目录下，命名规则如下：

### 同名不同后缀 → 自动编号

当源目录中存在同名但不同扩展名的文件时，按字母顺序编号：

```
源目录:  photo.png + photo.jpg + photo.gif
输出:    output/photo_01.webp
        output/photo_02.webp
        output/photo_03.webp
```

### 不同名或不同文件 → 直接覆盖

```
源目录:  banner.png + logo.jpg
输出:    output/banner.webp
        output/logo.webp
```

### 同格式转换 → 直接覆盖

```
源目录:  photo.webp
输出:    output/photo.webp  (直接覆盖，无双重后缀)
```

### 输出目录结构

```
📁 原目录/
├── 📁 output/          ← 转换后的文件
│   ├── photo.webp
│   ├── banner.jpg
│   └── photo_01.png
├── photo.png
├── banner.jpg
└── logo.gif
```

---

## 支持的格式

| 类型 | 格式 |
|------|------|
| **输入** | png, jpg, jpeg, gif, bmp, tiff, webp, avif |
| **输出** | webp, jpg, png, avif, gif, tiff |

---

## 使用示例

### 示例 1：批量转换照片集

```bash
# 将 photos 目录下的所有图片递归转换为 webp
cis -r -p ./photos -t webp
```

### 示例 2：压缩图片体积

```bash
# 将图片转换为 avif（体积更小，画质接近）
cis -p ./screenshots -t avif
```

### 示例 3：仅处理 PNG 图片

```bash
# 只转换 png 格式，输出为 jpg
cis -p ./icons -e png -t jpg
```

### 示例 4：限制递归深度

```bash
# 只递归 1 层子目录
cis -r -d 1 -p ./project
```

### 示例 5：单文件转换

```bash
# 转换单个文件，指定输出格式
cis -f ./avatar.png -t webp
```

---

## 安装与更新

```bash
# 安装
npm install -g change-image-suffix

# 更新
npm update -g change-image-suffix
```

## 开发

```bash
# 克隆项目
git clone https://gitee.com/siriussupreme/change-image-suffix.git
cd change-image-suffix

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 链接到全局（开发时）
npm link
```

## License

MIT
