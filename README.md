# AIChatOffice

[中文](README.md) | [English](README_EN.md)

<p align="center">
  <img src="docs/images/logo_1.svg" alt="AIChatOffice Logo" width="500"/>
</p>

<p align="center">
  <a href="https://github.com/yourusername/aichatoffice/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/yourusername/aichatoffice" alt="license"/>
  </a>
  <a href="https://github.com/yourusername/aichatoffice/releases">
    <img src="https://img.shields.io/github/v/release/yourusername/aichatoffice" alt="release"/>
  </a>
</p>

# AI ChatOffice (OfficeAI 助手) - 重新定义智能办公体验

在当今快节奏的商业环境中，效率不再是一种选择，而是生存的必要条件。想象一下，当您面对堆积如山的文档、复杂的数据分析任务和紧迫的创意需求时，有一位全天候的智能助手随时待命，理解您的需求，预测您的意图，并以前所未有的速度和精确度完成任务。这不再是科幻小说中的场景，而是 AI ChatOffice (OfficeAI 助手)为您带来的现实。

## 智能办公的新纪元

AI ChatOffice 的诞生源于一个简单而深刻的洞察：现代办公软件虽然功能强大，但学习曲线陡峭，操作复杂，往往成为创意和效率的障碍而非助力。我们的开发团队由一群热衷于人工智能和办公自动化的专业人士组成，他们深知当今办公环境的痛点和挑战。

AI ChatOffice 不仅仅是一款办公软件，它是办公理念的革命性转变。在人工智能和自然语言处理技术的飞速发展背景下，我们创造了这款智能助手，旨在彻底改变您与办公软件交互的方式。

想象一下，当您需要撰写一份详尽的季度报告时，不再需要从头开始构思框架、搜集数据、格式化图表，而是简单地告诉 AI ChatOffice 您的需求，它会立即理解并开始工作。当您需要分析复杂的财务数据时，不再需要记忆晦涩的 Excel 公式或函数，只需用自然语言描述您的需求，AI 就能为您完成。这就是 AI ChatOffice 带来的全新办公体验。

## 为什么选择 AI ChatOffice？

在众多办公辅助工具中，AI ChatOffice 凭借其独特的优势脱颖而出：

### 深度集成，无缝体验

AI ChatOffice 直接支持包括 docx、xlsx、markdown、pdf 等常用格式。这意味着您无需学习新的界面，就能享受 AI 带来的强大功能。无论是在 Word 中撰写文档，还是在 Excel 中分析数据，AI ChatOffice 都如影随形，随时准备提供帮助。

### 理解意图，而非仅执行命令

AI ChatOffice 不仅能执行您明确指定的任务，还能理解您的潜在意图。例如，当您要求"整理这份报告"时，它不仅会调整格式，还会分析内容，优化结构，甚至提出改进建议。这种深层次的理解能力使 AI ChatOffice 成为真正意义上的智能助手，而非简单的命令执行器。

### 隐私至上，安全可靠

在数据安全日益重要的今天，AI ChatOffice 将用户隐私放在首位。所有敏感数据处理都可以在本地完成，无需上传到云端。您可以完全控制哪些信息可以被 AI 访问，哪些需要保持私密。这种灵活的隐私控制机制使 AI ChatOffice 成为企业级用户的理想选择。

## ✨ 特性

- 📝 智能文档处理

  - 多种格式文档预览
  - 文档内容智能分析

- 💬 智能对话

  - 自然语言多轮对话
  - 上下文理解和记忆
  - 文档相关问答

- 插件式架构

  - 支持接入不同的文档处理、大语言模型供应方

## 🚀 快速开始

### 环境要求

- Node.js >= 16
- Go >= 1.18
- Git

### 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/aichatoffice.git
cd aichatoffice

# 安装前端依赖
cd app
npm install

# 安装后端依赖
cd ..
go mod tidy
```

### 开发

```bash
# 启动前端开发服务
cd app
npm run dev

# 启动后端服务
make server
```

### 构建

```bash
# 构建桌面应用
cd app
npm run build
```

## 🔧 技术架构

### 架构图

![](docs/images/architecture.png)

### 前端

- Electron - 跨平台桌面应用框架
- React - 用户界面库
- TypeScript - 开发语言
- TailwindCSS - CSS 框架
- Vite - 构建工具

### 后端

- Go - 开发语言
- Gin - HTTP 框架
- EGO - 微服务框架
- SQLite - 数据存储

### 依赖服务

该项目的核心功能依赖以下两种外部服务，以下是它们需要实现的功能：

- 文档处理服务

  - 预览文档
  - 获取文档内容

- AI 能力服务

  - 兼容 openai 协议的大语言模型

## 疑问解答

```
AIChatOffice.app is is damaged and can't be opened. You should move it to the Trash
```

命令行执行：

```shell
xattr -cr /Applications/AIChatOffice.app
```

## 📖 文档

//TODO - [API 文档](docs/api.md)
//TODO - [贡献指南](CONTRIBUTING.md)

## 开发计划

//todo roadmap

## 🤝 贡献

我们欢迎任何形式的贡献，包括但不限于：

- 提交问题和建议
- 改进文档
- 提交代码改进
- 分享使用经验

请阅读 [贡献指南](CONTRIBUTING.md) 了解更多信息。

## 📜 开源协议

本项目采用 [MIT 协议](LICENSE)。

## 🙏 致谢

感谢以下开源项目：

- [EGO](https://github.com/gotomicro/ego)
- [Vercel-AI-SDK](https://github.com/vercel/ai)
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Gin](https://gin-gonic.com/)
- [TailwindCSS](https://tailwindcss.com/)

## 📞 联系我们

- 提交 Issue: [GitHub Issues](https://github.com/aichatoffice/aichatoffice/issues)
