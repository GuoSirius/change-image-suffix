# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.1.8](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.7...v2.1.8) (2026-05-25)


### Bug Fixes

* remove nested quotes from bat set commands to handle paths with spaces ([becd55f](https://github.com/GuoSirius/change-image-suffix/commit/becd55f3dbf669b295b7e8f5b006e9939da910ac))

### [2.1.7](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.6...v2.1.7) (2026-05-25)


### Bug Fixes

* add %1 to context menu bat commands so selected files are passed ([db6cf30](https://github.com/GuoSirius/change-image-suffix/commit/db6cf300839e12ec0229057b25299e50f37f4b6b))

### [2.1.6](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.5...v2.1.6) (2026-05-25)


### Bug Fixes

* use inline shell sub-keys instead of ExtendedSubCommandsKey for context menu ([2f50376](https://github.com/GuoSirius/change-image-suffix/commit/2f50376a62a17bcf317530e0662f5b2d718d53d0))


### Chores

* update local settings permissions and refresh lockfile ([71d0c1e](https://github.com/GuoSirius/change-image-suffix/commit/71d0c1e6124006e827a3c0d078f9cc47699a3f4c))

### [2.1.5](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.4...v2.1.5) (2026-05-23)


### Chores

* upgrade deps (sharp 0.34, TS6, @types/node 25), migrate to ESM, require node >=24 ([d3a3234](https://github.com/GuoSirius/change-image-suffix/commit/d3a323410ccd1f5ed9f04443adc25c6edd96f7df))

### [2.1.4](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.3...v2.1.4) (2026-05-23)


### Bug Fixes

* output to <format>/ dir, command injection, recursive nesting, and other issues ([32da38a](https://github.com/GuoSirius/change-image-suffix/commit/32da38aef36a7d736e91e0375573a905d565d864))


### Chores

* update local settings permissions ([1a86130](https://github.com/GuoSirius/change-image-suffix/commit/1a86130de6005348d6ba8aaba26500d7688be996))


### Documentation

* update README output convention, add .claude/ commit policy memory ([b689bc6](https://github.com/GuoSirius/change-image-suffix/commit/b689bc60ed397eb826954e289c3f89488bd97449))

### [2.1.3](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.2...v2.1.3) (2026-05-21)


### Bug Fixes

* **context-menu:** auto-refresh menu on version change, gate preuninstall on global ([396dc45](https://github.com/GuoSirius/change-image-suffix/commit/396dc45f1d0606a16828f8e9467194ec933487d8))

### [2.1.2](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.1...v2.1.2) (2026-05-21)


### Bug Fixes

* add stdio inherit to release.js git commands for visible output ([7644eba](https://github.com/GuoSirius/change-image-suffix/commit/7644ebab76a090fd199cf1429edc0ccfa4a25323))

### [2.1.1](https://github.com/GuoSirius/change-image-suffix/compare/v2.1.0...v2.1.1) (2026-05-21)


### Bug Fixes

* unify format constants, remove dead code, sync docs with source ([c1e7700](https://github.com/GuoSirius/change-image-suffix/commit/c1e7700ee5f5a0142c98f5a1e95bc6453317a4a9))

## [2.1.0](https://github.com/GuoSirius/change-image-suffix/compare/v2.0.2...v2.1.0) (2026-05-21)


### Features

* auto context-menu lifecycle hooks, enable declarations, add dev script ([ab44e37](https://github.com/GuoSirius/change-image-suffix/commit/ab44e374040fbfa6715edacb8fb249eeaf746821))


### Bug Fixes

* rewrite bat script, remove gif/heif/jp2, same-format copy, quality 90 ([085a589](https://github.com/GuoSirius/change-image-suffix/commit/085a589f96682626834ac9715f7f228d52bfe89d))


### Chores

* include .claude/ for cross-device project settings ([c863337](https://github.com/GuoSirius/change-image-suffix/commit/c863337e926826a1799ea0ff4bc6e1f0790afee0))


### Documentation

* add CLAUDE.md for project onboarding on other devices ([c7f06bc](https://github.com/GuoSirius/change-image-suffix/commit/c7f06bc9c670b31e3e9af9329cbce96b5d3ed065))
* add project memory for context-menu fix and codebase context ([e8fb432](https://github.com/GuoSirius/change-image-suffix/commit/e8fb43252cf1288d503c24737b84b2f687e19968))

### [2.0.2](https://github.com/GuoSirius/change-image-suffix/compare/v2.0.1...v2.0.2) (2026-05-19)


### CI/CD

* add build step to GitHub Actions ([d900c7b](https://github.com/GuoSirius/change-image-suffix/commit/d900c7b69c390554aeb1f76a940e178688f8a6c5))

### [2.0.1](https://github.com/GuoSirius/change-image-suffix/compare/v2.0.0...v2.0.1) (2026-05-19)

## [2.0.0](https://github.com/GuoSirius/change-image-suffix/compare/v1.18.2...v2.0.0) (2026-05-19)


### Refactoring

* simplify GitHub Actions workflow - only publish to npm ([c0111f4](https://github.com/GuoSirius/change-image-suffix/commit/c0111f4a10d64b6b884ed277ece158e04ce03b61))


### Chores

* add .versionrc to show all commit types in CHANGELOG ([8c9860b](https://github.com/GuoSirius/change-image-suffix/commit/8c9860b77e6584cf46559adba2309ac2f531f437))
* restore complete publish workflow with CHANGELOG extraction and GitHub Release ([0a2e5e4](https://github.com/GuoSirius/change-image-suffix/commit/0a2e5e44e7890e7f6b1dcd232c96d031059265dd))
* simplify GitHub Actions - only publish to npm ([1621a04](https://github.com/GuoSirius/change-image-suffix/commit/1621a04396ae58d8cda4b430c29464bc6333bab0))
* update GitHub Actions workflow with CHANGELOG extraction ([11529dd](https://github.com/GuoSirius/change-image-suffix/commit/11529ddef272576a2622e0a5938926d47e2dd8ec))
* update GitHub Release format - What's Changed + Installation + Changelog ([d976363](https://github.com/GuoSirius/change-image-suffix/commit/d976363381e05d8310058a871af1f050286b2c12))
* use GitHub auto-generated release notes ([e2844a7](https://github.com/GuoSirius/change-image-suffix/commit/e2844a703edee055649ad8f2957c4566b1335cd9))

### [1.18.3](https://github.com/GuoSirius/change-image-suffix/compare/v1.18.2...v1.18.3) (2026-05-19)

### [1.18.2](https://github.com/GuoSirius/change-image-suffix/compare/v1.18.1...v1.18.2) (2026-05-19)


### Features

* add npm publish config and github release with changelog ([105e113](https://github.com/GuoSirius/change-image-suffix/commit/105e113c6ecd03085560be99ce5236240b68fa17))


### Bug Fixes

* improve GitHub Actions workflow and standard-version integration ([01e1ce4](https://github.com/GuoSirius/change-image-suffix/commit/01e1ce4d1a8b8e56b120f162ab93e7f3a3311074))
* remove deprecated husky script lines ([7261d48](https://github.com/GuoSirius/change-image-suffix/commit/7261d4874337105255beeca690d8b6013bc86f1c))
* remove duplicate content in CHANGELOG.md ([db0f4b6](https://github.com/GuoSirius/change-image-suffix/commit/db0f4b6403935ed713e2df2d6d1029b1b17aabe4))
* replace inquirer with enquirer for CommonJS compatibility ([6fe88a5](https://github.com/GuoSirius/change-image-suffix/commit/6fe88a51487cb92117e0c487592048b07804c89a))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
