# 🧞‍♂️ EduGenie

### **The World's Knowledge, Accelerated by Local AI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Local_AI-white?style=flat&logo=ollama)

---

**EduGenie** is a next-generation, local-first educational platform designed to empower students (ages 10–18) with a private, powerful, and multimodal learning assistant. Unlike traditional tools, EduGenie runs **100% locally**—no cloud, no subscriptions, and zero data leaves your machine.

---

## 🚀 Why EduGenie?

- **🔒 100% Private:** Your learning data, PDFs, and queries stay on your hardware.
- **⚡ Optimized for 6GB VRAM:** Specialized memory management allows high-end AI to run on mid-range consumer GPUs.
- **🌈 Multimodal Brain:** Learns from PDFs, YouTube, and text to generate custom diagrams, images, and videos.
- **🎮 Gamified Learning:** Integrated XP, streaks, and badges to keep students engaged.

---

## ✨ The "Magic" Behind the Genie

| Feature | The Technology |
| :--- | :--- |
| **The Brain** | **Llama 3.1 8B** via Ollama for expert-level explanations and tutoring. |
| **The Sight** | **FLUX.1 & Wan2.1** for generating textbook-quality diagrams and educational videos. |
| **The Voice** | **Kokoro-82M** crystal-clear TTS and **Faster-Whisper** for voice commands. |
| **The Memory** | **Qdrant Vector DB** for ultra-fast retrieval of facts from your uploaded documents. |
| **The Teacher** | **IBM Docling** & **BGE Reranker** to ensure educational accuracy and relevance. |

---

## 🛠️ The Technical Edge: VRAM Exclusive Lock

EduGenie features a proprietary **VRAM Locking System**. Large models like LLMs and Video Generators often compete for GPU memory. Our system:
1.  **Orchestrates:** Queues AI tasks to prevent GPU overflows.
2.  **Unloads:** Automatically releases Ollama from VRAM before triggering ComfyUI (Image/Video Gen).
3.  **Protects:** Ensures a smooth experience even on 6GB NVIDIA cards.

---

## 📦 Quick Start

### 1. Prerequisites
- **Docker Desktop** (for Qdrant & Redis)
- **Ollama** (for the LLM & Embeddings)
- **Node.js 18+** & **Python 3.10+**
- **NVIDIA GPU** (6GB VRAM recommended)

### 2. The One-Click Launch
We've automated everything. Just run:
```bash
# Windows
startup.bat

# Linux/macOS
chmod +x startup.sh && ./startup.sh
```
*This script pulls models, sets up Python environments, and launches all 8 services automatically.*

---

## 🗺️ v1.0 Roadmap & Beyond

- [x] **v1.0 Core:** RAG, TTS/STT, Image/Video Gen, and Gamification.
- [ ] **Interactive Whiteboard:** AI-guided step-by-step sketching.
- [ ] **Active Recall Export:** One-click export to Anki/Flashcards.
- [ ] **Parent Dashboard:** Local-only progress tracking for educators.
- [ ] **Lite Mode:** CPU-only fallback for machines without GPUs.

---

## 🤝 Contributing

We welcome contributions! Whether it's a new AI model integration or a UI tweak, feel free to open a PR.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for the future of education.*
