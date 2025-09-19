# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prios is a web-based personal optimization tool featuring radar charts for visualizing multi-dimensional data and priority allocation. The application uses D3.js for charting and provides two main views: Radar Charts and Priorities Tool.

## Architecture

The project is a vanilla JavaScript application with the following structure:

- **Main Application** (`Project/`): Contains the core web application
  - `index.html`: Single-page application with two views toggled via JavaScript
  - `main.js`: Page navigation controller
  - `radar.js`: D3.js-based radar chart implementation with support for 3D/5D profiles, Pareto frontier analysis, and overlay mode
  - `priorities.js`: Priority allocation tool with dynamic budget distribution
  - `values.js`: Values selection and visualization tool based on Brené Brown's values framework
  - `style.css`: Application styling

- **Plan Directory** (`Plan/`): Contains ECharts-based parallel coordinates visualization
  - `Track.js`: Nutrients parallel coordinates chart using ECharts library

- **Prios-main Directory**: Contains duplicate/backup files from the main project

The application uses external libraries via CDN:
- D3.js v7 for radar chart visualization
- ECharts (in Track.js) for parallel coordinates

## Key Features

1. **Radar Charts**: Visualizes multi-dimensional profiles (3D and 5D) with:
   - Multiple datasets (profiles, dominated, threshold, sleep, wall, profiles5d)
   - Overlay mode for comparing multiple profiles
   - Pareto frontier analysis and highlighting
   - Interactive legend with tooltips

2. **Priorities Tool**: Budget-based priority allocation with:
   - Dynamic priority addition
   - Multiple sets support
   - Normalized visualization based on total budget

3. **Values Tool**: Personal values visualization with:
   - Brené Brown's complete values list (117 values)
   - Random value selection
   - Weighted radar chart generation

## Development Commands

This is a static website with no build process. To run locally:
- Open `Project/index.html` directly in a browser, or
- Use a local web server (e.g., `python -m http.server` in the Project directory)

No package manager, linting, or test commands are configured.