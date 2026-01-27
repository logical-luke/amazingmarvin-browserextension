# Amazing Marvin - Browser Extension (Fork)

> **Note:** This is a fork of the [official Amazing Marvin browser extension](https://github.com/amazingmarvin/amazingmarvin-browserextension) with additional platform integrations and AI-powered features.

Add to [Chrome/Edge](https://chrome.google.com/webstore/detail/amazing-marvin/gjohmhcpmpjfnkipjjcgmiklimmjfhlp), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/amazing-marvin/), Safari (soon!)

## Table of Contents

- [About the Project](#about-the-project)
- [Fork Enhancements](#fork-enhancements)
- [Features](#features)
- [Built with](#built-with)
- [Installation](#installation)
- [Roadmap](#roadmap)

## About the Project

This browser extension helps you quickly add tasks to your Marvin account without having to open the app. Besides being able to add new tasks to Marvin, it also allows you to:

* See your daily list of tasks
* Add emails to Marvin from Gmail
* Add snippets of selected text to Marvin in just two clicks
* See your currently tracked task in the popup

## Fork Enhancements

This fork adds significant new capabilities beyond the original extension:

### Platform Integrations

**Jira Cloud Integration**
- "Add to Marvin" button appears on issue detail views, board cards, and backlog lists
- Smart title generation based on issue type (Task, Bug, Story, Epic)
- Automatically extracts issue metadata including key, summary, description, type, and priority

**Slack Integration**
- Native-style button integrated into Slack's message actions toolbar
- Works in channels, direct messages, and threads
- Captures message content, sender, channel name, and timestamp

**GitHub Integration**
- Buttons on PR detail pages, PR lists, timeline comments, review comments, and notifications
- Context-aware smart titles (Review PR, Merge PR, Fix Pipeline, Address Review Comments)
- Automatically detects your PRs vs. others and check/review status
- Extracts linked Jira issues from PR titles and descriptions

### AI-Powered Features

**Smart Task Suggestions**
- Multi-provider support: Claude (Anthropic), OpenAI (GPT), and Google Gemini
- Generates intelligent task titles based on page context
- Suggests time estimates for tasks
- Provides AI summaries in task notes

**Context-Aware Autocomplete**
- Gathers context from the current page (Jira, Slack, GitHub, Gmail)
- Platform-specific title templates for natural task names

### Enhanced Add Task Form

- Priority picker (yellow, orange, red stars)
- Frog status picker (normal, baby, monster frogs)
- Reward points configuration
- Currently tracked task display in popup header

## Features

This section lists features available in the extension:

* **Badge with task count** - Shows the number of tasks scheduled for today
* **Gmail Addon** - Add emails to Marvin from both the email list and single email views. A confirmation message appears when tasks are created.
* **Context menu buttons** - Right-click to create a task with:
  * Title as a hyperlink containing the page title and URL
  * Selected text added to the task note
* **Options page** - Configure:
  * Which buttons/inputs are visible in the Add Task view
  * API token management
  * Force sync categories and labels
  * Where "Add to Marvin" buttons appear in Gmail, Jira, Slack, and GitHub
  * AI suggestions provider and API key
  * Smart autocomplete settings

## Built with

Extension is built using:

* [React](https://react.dev) for the UI
* [TailwindCSS](https://tailwindcss.com/) and [DaisyUI](https://daisyui.com/) for styling
* [Parcel](https://parceljs.org/recipes/web-extension/) for bundling
* [React DayPicker](https://react-day-picker.js.org/) for the date picker
* [React Icons](https://react-icons.github.io/react-icons/) for icons

## Installation

### Building the extension

To start editing or using the extension, you'll first need to clone the repo
and install the dependencies. After that you'll need to build it and then load
it in your browser. Building requires `node` (tested with v14 and higher), and
`npm`.

1. Clone the repo
   ```sh
   gh repo clone logical-luke/amazingmarvin-browserextension
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Run build script
   ```sh
   npm run build
   ```
4. Build for Firefox
   ```sh
   npm run ff:build
   ```
5. Build and watch source (for development)
   ```sh
   npm run start
   ```

### Loading the extension in your browser

To load the extension, go to the extensions page in your browser. For Chrome,
you can go to `chrome://extensions/` and for Edge, you can go to
`edge://extensions/`. Once you're there, click on the "Load unpacked" button
and select the `out/dev` folder from the project. If you don't see the "Load
unpacked" button, be sure to toggle "Developer mode".

In Firefox, open `about:debugging#/runtime/this-firefox` and click "Load
Temporary Add-On..." and select the `out/ff` folder from the project.

## Roadmap

Completed enhancements in this fork:

- [x] Optimize content script code
- [x] Add support for Firefox
- [x] Display currently tracked task in the popup
- [x] Add priorities, frog status, and reward points to Add Task form
- [x] Autocomplete categories, labels, and others while inputting tasks
- [x] AI-powered task suggestions with multi-provider support
- [x] Jira Cloud integration
- [x] Slack integration
- [x] GitHub integration (PRs, issues, comments, notifications)

See the [open issues](https://github.com/logical-luke/amazingmarvin-browserextension/issues) for a list of proposed features and known issues.
