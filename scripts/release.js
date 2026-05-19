#!/usr/bin/env node

const { execSync } = require('child_process');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
  return pkg.version;
}

function calculateNextVersion(currentVersion, releaseType) {
  const parts = currentVersion.split('.').map(Number);
  switch (releaseType) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      return currentVersion;
  }
}

function checkUnstagedFiles() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    return output.trim() !== '';
  } catch (error) {
    return false;
  }
}

function getUnstagedFiles() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    return output.trim();
  } catch (error) {
    return '';
  }
}

function hasRemote(name) {
  try {
    const output = execSync('git remote -v', { encoding: 'utf-8' });
    return output.includes(name);
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('\n🚀 一键发布脚本');
  console.log('================\n');

  const currentVersion = getCurrentVersion();
  console.log(`当前版本: ${currentVersion}\n`);

  if (checkUnstagedFiles()) {
    console.log('检测到未提交的文件:');
    console.log(getUnstagedFiles());
    console.log('');

    const { commitMessage } = await inquirer.prompt({
      type: 'input',
      name: 'commitMessage',
      message: '请输入提交信息（需符合Conventional Commits规范）:',
      validate: (value) => {
        if (!value.trim()) {
          return '提交信息不能为空';
        }
        if (!/^(feat|fix|docs|style|refactor|perf|test|chore)(\([^)]+\))?: .+/.test(value)) {
          return '提交信息格式不正确，应符合Conventional Commits规范，例如: feat(auth): add login feature';
        }
        return true;
      }
    });

    console.log('\n执行 git add...');
    execSync('git add .');

    console.log('执行 git commit...');
    execSync(`git commit -m "${commitMessage}"`);
    console.log('✅ 提交成功\n');
  }

  const { releaseType } = await inquirer.prompt({
    type: 'list',
    name: 'releaseType',
    message: '请选择版本更新类型:',
    choices: [
      {
        name: `patch (${currentVersion} → ${calculateNextVersion(currentVersion, 'patch')}) - 修复bug`,
        value: 'patch'
      },
      {
        name: `minor (${currentVersion} → ${calculateNextVersion(currentVersion, 'minor')}) - 新增功能`,
        value: 'minor'
      },
      {
        name: `major (${currentVersion} → ${calculateNextVersion(currentVersion, 'major')}) - 重大变更`,
        value: 'major'
      }
    ]
  });

  const nextVersion = calculateNextVersion(currentVersion, releaseType);

  const { confirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message: `即将发布 ${releaseType} 版本: ${currentVersion} → ${nextVersion}，确认继续？`,
    default: true
  });

  if (!confirm) {
    console.log('❌ 发布已取消');
    process.exit(0);
  }

  console.log('\n📦 执行 standard-version 更新版本和changelog...');
  execSync(`npx standard-version --release-as ${releaseType} --skip.tag`);
  console.log('✅ 版本和changelog更新成功');

  console.log('\n🏷️ 打标签...');
  const newVersion = getCurrentVersion();
  execSync(`git tag -a v${newVersion} -m "chore(release): ${newVersion}"`);
  console.log(`✅ 标签 v${newVersion} 创建成功`);

  console.log('\n📤 推送到 origin...');
  execSync('git push origin main');
  console.log('✅ 推送 origin 成功');

  if (hasRemote('github')) {
    console.log('\n📤 推送到 github...');
    execSync('git push github main');
    console.log('✅ 推送 github 成功');
  }

  console.log('\n📤 推送 tags...');
  execSync('git push --tags origin');
  if (hasRemote('github')) {
    execSync('git push --tags github');
  }
  console.log('✅ Tags 推送成功');

  console.log('\n📦 发布到 npm...');
  execSync('npm publish');
  console.log('✅ npm 发布成功');

  console.log('\n🎉 发布完成！新版本: ' + getCurrentVersion());
}

main().catch((error) => {
  console.error('\n❌ 发布失败:', error.message);
  process.exit(1);
});