# Contributing to Web3 UPI

Thank you for considering contributing to Web3 UPI! This document provides guidelines for contributing to the project.

## 🍴 How to Fork and Contribute

1. **Fork the Repository**
   - Click "Fork" on GitHub to create your own copy
   - Clone your fork locally:
     ```bash
     git clone https://github.com/YOUR_USERNAME/web3-UPI.git
     cd web3-UPI
     ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Follow the project's coding style (see below)
   - Test your changes thoroughly
   - Ensure the app still runs with `npx serve`

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "Add: brief description of your change"
   ```

5. **Push and Create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a Pull Request on GitHub

## 🚀 Running Locally

See the main [README.md](README.md#-how-to-run-locally) for setup instructions.

**Quick Start:**
```bash
npx serve
```
Then open `http://localhost:3000` in your browser.

## 📋 Contribution Guidelines

### Keep Changes Minimal
- Focus on **one feature or fix per PR**
- Avoid refactoring unrelated code
- Preserve existing behavior unless explicitly fixing a bug

### No Breaking Changes
- Do **not** delete or move existing files without discussion
- Do **not** change public APIs or contracts
- Do **not** alter the UI/UX without proposal approval

### Code Quality
- **Comment your code**: Explain *why*, not *what*
- **Test your changes**: Manually test affected features
- **No console errors**: Ensure the browser console is clean
- **Responsive design**: Test on mobile and desktop viewports

### Safe AI Changes
If modifying AI safety utilities (`PromptSanitizer`, `ResponseGuardrails`, etc.):
- Do **not** weaken existing safety checks
- Add tests/examples for new patterns
- Document changes in PR description

## 🐛 Reporting Bugs

Found a bug? Great! Please:
1. Check if it's already reported in [Issues](../../issues)
2. If not, create a new issue with:
   - Clear title (e.g., "Bitcoin address detection fails for bc1p... addresses")
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser and OS version

## 💡 Feature Requests

Have an idea? We'd love to hear it!
1. Open a [GitHub Discussion](../../discussions) or Issue
2. Describe the feature and use case
3. Wait for feedback before starting implementation (saves time!)

## 🎨 Design Contributions

For UI/UX changes:
- Include screenshots or mockups in your PR
- Explain the design rationale
- Ensure accessibility (color contrast, keyboard navigation)

## 📜 Governance Contracts

This project uses **system contracts** to document critical behaviors:
- Located in `governance/` folder
- Do **not** modify these without approval
- Propose changes via GitHub Issues first

## 🤝 Code of Conduct

- Be respectful and constructive
- Welcome newcomers and answer questions
- Focus on the code, not the person
- Follow GitHub's [Community Guidelines](https://docs.github.com/en/site-policy/github-terms/github-community-guidelines)

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for making Web3 UPI better!** 🙌
