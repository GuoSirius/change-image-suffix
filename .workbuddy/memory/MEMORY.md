# Project Memory — change-image-suffix

基于 [sharp](https://sharp.pixel.glass/) 的批量图片格式转换 + 空白裁剪 CLI 工具（Windows 右键菜单集成）。

## 关键约定
- 项目记忆目录（本目录）随代码一并提交，改动需与代码一起 `git add`（详见 [workbuddy-dir-committed](workbuddy-dir-committed.md)）。
- 双 bin 名：`change-image-suffix` 与 `cis`（短别名）。
- 输出约定：转换结果放入 `<源目录>/<目标格式>/`，空白裁剪结果放入 `<源目录>/cropped/`，文件名保持原样。
- 同名不同后缀冲突 → 加 `_01`/`_02` 编号；同格式直接 `copyFileSync` 避免重编码。
- `dist/` 不入库（prepublishOnly 构建），`src/` 为源码真源。
- CHANGELOG 由 `npm run release`（standard-version）自动生成，**不要手动维护**。

## 右键菜单（仅 Windows）
- `cis install-menu` 写入 HKCU，无需管理员；用 `ExtendedSubCommandsKey` 级联子菜单（格式 + 「裁剪空白」），直接调 `node.exe` 避免 bat 编码问题。
- `AllFilesystemObjects` + `MultiSelectModel=Player` 支持文件/目录混合多选。
- 历史坑与修复详见 [context-menu-bat-fix](context-menu-bat-fix.md)。

## 技术栈 / 构建
- 构建：`npm run build`（tsc）；`npm link` 注册全局。
- 提交规范：Conventional Commits + commitlint（husky `commit-msg` 钩子）。
- 发布：`npm run release`（standard-version 自动更新 CHANGELOG / 打 tag / 推远程 / npm publish）。
- 发布校验：用 `npm pack --dry-run` 查看 tarball 内容；`files` 白名单优先级高于根 `.npmignore`（根级 `.npmignore` 不会剔除 `files` 中列出的文件，例如生命周期脚本 `scripts/*.cjs` 仍会发布）。
