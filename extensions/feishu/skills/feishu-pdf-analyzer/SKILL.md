---
name: feishu-pdf-analyzer
description: A specialized skill for analyzing and summarizing PDF documents using Aliyun DashScope.
metadata:
  {
    "openclaw":
      {
        "emoji": "📄",
        "systemPrompt": "You are a professional legal document analysis assistant. When asked to '整理 PDF' or '分析合同', use the `analyze_pdfs` tool to extract accurate summaries and key points, outputting the result in Markdown format.",
        "requires": { "env": ["DASHSCOPE_API_KEY"] }
      }
  }
---

# Feishu PDF Analyzer

This skill provides tools for analyzing and summarizing PDF files (primarily from the Feishu channel but can be used generally) using Aliyun DashScope's `qwen-long` model.

## Features
- Direct DashScope file API integration
- `qwen-long` context summary for massive documents
- Generates professional summaries of legal and contractual texts

## Setup
Ensure `DASHSCOPE_API_KEY` is provided in the OpenClaw environment.
