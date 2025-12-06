# Publishing Guide for git-data-source

## Pre-Publishing Checklist

### 1. Update Package Metadata

Edit `/workspace/git-data-source/package.json`:

- [ ] Update `author` field: `"Your Name <your.email@example.com>"`
- [ ] Update `repository.url`: `"https://github.com/yourusername/git-data-source.git"`
- [ ] Update `bugs.url`: `"https://github.com/yourusername/git-data-source/issues"`
- [ ] Update `homepage`: `"https://github.com/yourusername/git-data-source#readme"`

### 2. Install Dependencies

```bash
cd /workspace/git-data-source
npm install
```

### 3. Run Quality Checks

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Build the package
npm run build
```

### 4. Verify Build Output

Check that `/workspace/git-data-source/dist/` contains:
- `index.js` (ESM)
- `index.cjs` (CommonJS)
- `index.d.ts` (TypeScript declarations for ESM)
- `index.d.cts` (TypeScript declarations for CJS)
- Source maps

### 5. Test Package Locally

```bash
# Create a test installation
npm pack

# This creates git-data-source-0.1.0.tgz
# Install in another project:
npm install /path/to/git-data-source-0.1.0.tgz
```

### 6. Verify Package Contents

```bash
npm publish --dry-run
```

This will show you exactly what files will be published without actually publishing.

## Publishing to npm

### First-Time Setup

```bash
# Login to npm
npm login
```

### Check Package Name Availability

```bash
npm search git-data-source
```

If the name is taken, you can:
1. Use a scoped package: `@yourusername/git-data-source`
2. Choose a different name

Update `package.json` name field accordingly.

### Publish

```bash
# Dry run first (recommended)
npm publish --dry-run

# Actually publish
npm publish

# For scoped packages (if using @yourusername/git-data-source):
npm publish --access public
```

## Post-Publishing

### 1. Create GitHub Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag: `v0.1.0`
4. Title: `v0.1.0 - Initial Release`
5. Description: Copy from CHANGELOG or write release notes

### 2. Verify npm Package

Visit: `https://www.npmjs.com/package/git-data-source`

Check:
- README displays correctly
- Package metadata is correct
- Installation instructions work

### 3. Test Installation

```bash
# In a new directory
npm install git-data-source

# Verify it works
node -e "const { GitDataSource } = require('git-data-source'); console.log('Success!');"
```

### 4. Update Badges

Once published, the npm version badge in README.md will work:
```markdown
[![npm version](https://badge.fury.io/js/git-data-source.svg)](https://www.npmjs.com/package/git-data-source)
```

## Updating the Package

### Version Bumping

```bash
# Patch release (0.1.0 -> 0.1.1)
npm version patch

# Minor release (0.1.0 -> 0.2.0)
npm version minor

# Major release (0.1.0 -> 1.0.0)
npm version major
```

This will:
1. Update version in package.json
2. Create a git tag
3. Commit the change

### Publish Update

```bash
# Run prepublishOnly checks automatically
npm publish
```

## Package Configuration Files

### package.json
- Dual ESM/CJS exports via `exports` field
- Proper entry points: `main`, `module`, `types`
- `files` field specifies what gets published
- `prepublishOnly` script runs checks before publishing

### tsconfig.json
- Target: ES2022
- Module: ESNext (for modern output)
- Strict type checking enabled
- Declaration files generated

### tsup.config.ts
- Builds both ESM and CJS formats
- Generates TypeScript declaration files for both formats
- Tree-shaking enabled
- Source maps included
- External dependencies not bundled

### .npmignore
- Excludes source files, tests, and docs
- Only `dist/`, `README.md`, and `LICENSE` are published

### .gitignore
- Excludes build output and dependencies from git
- Keeps repository clean

## Troubleshooting

### Issue: "Package name already exists"

**Solution:** Use a scoped package name:
```json
{
  "name": "@yourusername/git-data-source"
}
```

### Issue: "prepublishOnly script failed"

**Causes:**
- TypeScript errors: Run `npm run typecheck`
- Test failures: Run `npm test`
- Build errors: Run `npm run build`

Fix errors before publishing.

### Issue: "Files missing from package"

**Check:**
1. `files` field in package.json includes necessary files
2. `.npmignore` isn't excluding needed files
3. Run `npm publish --dry-run` to preview

### Issue: "Module not found" after installation

**Verify:**
1. `exports` field in package.json is correct
2. Build output exists in `dist/` directory
3. Entry points (`main`, `module`, `types`) are correct

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Best Practices

1. **Semantic Versioning**: Follow semver (major.minor.patch)
2. **Changelog**: Maintain CHANGELOG.md for each release
3. **Testing**: Always run tests before publishing
4. **Git Tags**: Tag releases in git matching npm version
5. **Documentation**: Keep README.md up to date
6. **License**: Ensure LICENSE file is included
7. **Dependencies**: Keep dependencies updated and minimal

## Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [package.json Reference](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [tsup Documentation](https://tsup.egoist.dev/)
