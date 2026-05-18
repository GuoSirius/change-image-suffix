# 发布功能实现计划

## 一、需求分析

根据用户需求，需要实现以下发布功能：

| 序号 | 需求 | 描述 |
| :--- | :--- | :--- |
| 1 | Changelog增量记录 | 修改代码后，所有提交记录到changelog，增量添加，不覆盖 |
| 2 | 提交信息格式校验 | 使用commitlint强制符合Conventional Commits规范 |
| 3 | 一键发布脚本 | 检测未提交文件 → 用户输入提交信息 → 自动add/commit → 选择版本类型 → 更新版本/changelog/tag → 推送至origin/github |
| 4 | 构建发布 | 推送到github后构建发布，同时发布到npm |

## 二、技术方案

### 2.1 依赖选择

| 依赖 | 版本 | 用途 |
| :--- | :--- | :--- |
| @commitlint/cli | ^18.0.0 | 提交信息校验工具 |
| @commitlint/config-conventional | ^18.0.0 | 标准提交规范配置 |
| husky | ^8.0.0 | Git钩子管理工具 |
| standard-version | ^9.0.0 | 版本管理和changelog生成 |
| inquirer | ^9.0.0 | 交互式命令行界面 |

### 2.2 文件修改清单

| 文件 | 操作 | 说明 |
| :--- | :--- | :--- |
| package.json | 修改 | 添加依赖和脚本命令 |
| .commitlintrc.json | 新建 | commitlint配置文件 |
| .husky/pre-commit | 新建 | pre-commit钩子（可选） |
| .husky/commit-msg | 新建 | commit-msg钩子，校验提交信息 |
| CHANGELOG.md | 新建 | 初始changelog文件 |
| scripts/release.js | 新建 | 一键发布脚本 |

## 三、实施步骤

### 步骤1：安装依赖

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky standard-version inquirer
```

### 步骤2：初始化husky

```bash
npx husky install
npx husky add .husky/commit-msg 'npx --no-install commitlint --edit "$1"'
```

### 步骤3：配置commitlint

创建 `.commitlintrc.json` 配置文件，使用conventional规范。

### 步骤4：创建CHANGELOG.md

创建初始的changelog文件，包含项目基本信息。

### 步骤5：创建release脚本

编写 `scripts/release.js` 实现以下功能：
1. 检测未add和未commit的文件
2. 如有未提交文件，提示用户输入提交信息并自动提交
3. 使用inquirer提供版本类型选择（major/minor/patch）
4. 实时展示当前版本和选择后的目标版本
5. 确认后执行：
   - standard-version更新版本和changelog
   - 打tag
   - 推送至origin
   - 推送到github（如果配置了github remote）
   - npm publish

### 步骤6：配置package.json

添加以下脚本：
- `release`: 执行发布脚本
- `release:patch`: 发布patch版本
- `release:minor`: 发布minor版本
- `release:major`: 发布major版本

## 四、提交信息规范

使用Conventional Commits规范，格式如下：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**type可选值：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行的变动）
- `refactor`: 重构（既不是新增功能，也不是修改bug的代码变动）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具类改动

## 五、风险与注意事项

1. **git remote配置**: 需要确保项目已配置github remote，脚本会尝试推送到origin和github
2. **npm权限**: 执行npm publish需要用户已登录npm且有发布权限
3. **Node.js版本**: inquirer@9需要Node.js >= 14.18.0
4. **standard-version首次运行**: 首次运行会生成CHANGELOG并创建初始tag

## 六、预期结果

完成后，项目将具备：
1. 自动校验提交信息格式
2. 自动生成增量changelog
3. 一键发布功能，支持版本类型选择
4. 自动推送至多个remote并发布到npm

