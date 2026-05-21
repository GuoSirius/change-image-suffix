#!/usr/bin/env node

const { execSync } = require('child_process');
const { prompt } = require('enquirer');
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

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--patch')) return 'patch';
  if (args.includes('--minor')) return 'minor';
  if (args.includes('--major')) return 'major';
  return null;
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

    const response = await prompt({
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
    execSync(`git commit -m "${response.commitMessage}"`, { stdio: 'inherit' });
    console.log('✅ 提交成功\n');
  }

  let releaseType = parseArgs();

  if (!releaseType) {
    const releaseResponse = await prompt({
      type: 'select',
      name: 'releaseType',
      message: '请选择版本更新类型:',
      choices: [
        `patch (${currentVersion} → ${calculateNextVersion(currentVersion, 'patch')}) - 修复bug`,
        `minor (${currentVersion} → ${calculateNextVersion(currentVersion, 'minor')}) - 新增功能`,
        `major (${currentVersion} → ${calculateNextVersion(currentVersion, 'major')}) - 重大变更`
      ]
    });

    // 从选择的字符串中提取版本类型
    releaseType = releaseResponse.releaseType.split(' ')[0];
  }

  const nextVersion = calculateNextVersion(currentVersion, releaseType);
  console.log(`\n即将发布 ${releaseType} 版本: ${currentVersion} → ${nextVersion}\n`);

  const confirmResponse = await prompt({
    type: 'confirm',
    name: 'confirm',
    message: '确认继续？',
    initial: true
  });

  if (!confirmResponse.confirm) {
    console.log('❌ 发布已取消');
    process.exit(0);
  }

  console.log('\n📦 执行 standard-version 更新版本和changelog...');
  // standard-version 会自动更新 package.json、创建 CHANGELOG.md 和打 tag
  execSync(`npx standard-version --release-as ${releaseType}`, { stdio: 'inherit' });
  const newVersion = getCurrentVersion();
  console.log('✅ 版本和changelog更新成功，tag已创建: v' + newVersion);

  console.log('\n📤 推送到 origin...');
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('✅ 推送 origin 成功');

  if (hasRemote('github')) {
    console.log('\n📤 推送到 github...');
    execSync('git push github main', { stdio: 'inherit' });
    console.log('✅ 推送 github 成功');
  }

  console.log('\n📤 推送 tags...');
  execSync('git push --tags origin', { stdio: 'inherit' });
  if (hasRemote('github')) {
    execSync('git push --tags github', { stdio: 'inherit' });
  }
  console.log('✅ Tags 推送成功');

  console.log('\n🎉 发布完成！新版本: ' + newVersion);
  console.log('📝 GitHub Actions 将自动构建并发布到 npm...');

}

main().catch((error) => {
  console.error('\n❌ 发布失败:', error.message);
  process.exit(1);
});
