[中文说明](README_zh.md)

# My Text Tools for Obsidian

An advanced text processing workbench for Obsidian, inspired by and paying tribute to [mytexttools.com](https://mytexttools.com).

This plugin adds a dedicated "Text Tools Workbench" to Obsidian, providing a suite of powerful utilities for manipulating, formatting, and analyzing text without leaving your vault. It features a temporary editing area, allowing you to process text safely before applying changes to your notes.

## Features

My Text Tools organizes its utilities into several categories:

### 🛠️ Basic Tools

-   **Regex Find & Replace**: Perform complex search and replace operations using regular expressions.
-   **Remove Whitespace**:
    -   Trim leading/trailing whitespace.
    -   Compress multiple spaces into one.
    -   Remove all spaces or tabs.
-   **Text Conversion**:
    -   Uppercase/Lowercase conversion.
    -   Chinese punctuation standardization.
    -   Alphanumeric filtering.

### 📝 Line Operations

-   **Remove Duplicate Lines**: Instantly clean up lists by removing duplicates.
-   **Remove Empty Lines**: Strip out blank lines from your text.
-   **Add Prefix/Suffix**: Bulk add text to the beginning or end of every line.
-   **Filter Lines**: Keep or remove lines based on whether they contain a specific string or regex pattern.
-   **Number List**: Convert lines into a numbered list with customizable start numbers, steps, and formats.
-   **Line Breaks**: Manage line breaks (add or remove).

### 📊 Column Operations

Great for processing CSV-like data or structured text:

-   **Extract Column**: Pull out a specific column based on delimiters (Comma, Tab, Pipe, Space, or Custom).
-   **Swap Columns**: Easily swap the positions of two columns.

### 🔍 Extraction & Analysis

-   **Extract Content**: Extract text occurring between two markers (start/end tags), with regex support.
-   **Word Frequency**: Analyze text to find the most frequent words, with options to filter by length and include/exclude numbers.

### 🤖 AI Tools

Leverage the power of AI to process your text (requires OpenAI-compatible API configuration):

-   **Summarize**: Generate concise summaries of your text.
-   **Polish**: Improve grammar, flow, and clarity.
-   **Continue Writing**: Let AI expand on your current text.
-   **Translate**: Instantly translate text to your target language.

### ⚡ Custom Scripts

Extend functionality with your own code:

-   **JavaScript Execution**: Write and run custom JavaScript to process text in the editor.
-   **Script Management**: Save, edit, and delete your frequently used scripts in the settings.

## How to Use

1. **Open the Workbench**:
    - Click the "My Text Tools" icon (remove-formatting icon) in the left ribbon.
    - Or use the Command Palette (`Cmd/Ctrl + P`) and search for **"My Text Tools: Open Workbench"**.

2. **The Workbench Interface**:
    - **Left Panel**: Select the tool you want to use.
    - **Center Panel (Temporary Editor)**:
        - This text area is initialized with the content of your active note.
        - **Modifications here are temporary** and do not affect your note until you choose to save.
        - Supports **Undo (Ctrl+Z)** and **Redo (Ctrl+Y)**.
    - **Right Panel**: Configure settings for the selected tool (e.g., regex patterns, delimiters).

3. **Saving Changes**:
    - **Apply to Note**: Overwrites the original note with the content from the workbench.
    - **Save as New Note**: Creates a new file with the processed text.

## Settings

Go to **Settings > My Text Tools** to configure:
-   **Basic Settings**: Manage default tool visibility.
-   **AI Settings**: Configure API Endpoint, Key, and Model for AI features.
-   **Custom Scripts**: Add and manage your custom JavaScript snippets.

## Installation

Currently, this plugin is available for manual installation:

1. Download the `main.js`, `manifest.json`, and `styles.css` files from the latest release.
2. Create a folder named `my-text-tools` in your vault's plugin directory: `.obsidian/plugins/my-text-tools`.
3. Place the downloaded files into this folder.
4. Reload Obsidian and enable the plugin in Settings > Community Plugins.

## Credits & Inspiration

This plugin is a tribute to **[mytexttools.com](https://mytexttools.com)**. We aim to bring the convenience and power of their online text utilities directly into your local Obsidian environment.

---

_Note: This plugin is a work in progress. Always backup your data before performing bulk text operations._
