# Heimdall Viewer

A graphical viewer for CycloneDX SBOM (Software Bill of Materials) and VEX (Vulnerability Exploitability eXchange) files built with Electron.

## Features

- **Graphical SBOM Visualization**: View SBOM components in an interactive canvas with hierarchical relationships
- **Interactive Components**: Click, double-click, and right-click on components for different actions
- **Detail Editing**: Open components in detail windows with full editing capabilities
- **File Support**: Open and save both JSON and XML CycloneDX files
- **Modern UI**: Beautiful, responsive interface with smooth animations
- **Keyboard Shortcuts**: Quick access to common operations
- **Zoom and Pan**: Navigate large SBOMs with ease
- **Context Menus**: Right-click for additional options
- **Form Validation**: Built-in validation for PURL, CPE, and required fields
- **Enum Support**: Dropdown menus for enumerated fields with valid options

## Installation

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd heimdall-viewer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development version:
```bash
npm start
```

### Building for Production

1. Build the application:
```bash
npm run build
```

2. The executable will be created in the `dist` folder:
- **Linux**: `heimdall-viewer` (AppImage and unpacked binary)
- **Windows**: `Heimdall Viewer Setup.exe`
- **macOS**: `Heimdall Viewer.dmg`

### Installing on Linux

After building, you can install the application using the provided script:

```bash
./install.sh
```

This will:
- Install the application to `/opt/heimdall-viewer`
- Create a desktop entry
- Add a command-line symlink
- Make the application available in your application menu

To uninstall:
```bash
./uninstall.sh
```

## Usage

### Opening Files

1. Click "Open SBOM/VEX" or use Ctrl+O (Cmd+O on macOS)
2. Select a CycloneDX JSON or XML file
3. The SBOM will be displayed as interactive rectangles on the canvas

### Navigating the Canvas

- **Click**: Select a component (highlighted with gold border)
- **Double-click**: Open component details in a new window
- **Right-click**: Show context menu with additional options
- **Mouse wheel**: Zoom in/out
- **Drag**: Pan around the canvas

### Canvas Controls

- **Zoom In/Out**: Use the zoom buttons or +/- keys
- **Reset Zoom**: Click the reset button or press '0'
- **Fit to Screen**: Automatically fit all components to view
- **Center View**: Reset pan position

### Editing Components

1. Double-click any component to open the detail window
2. Edit the component information in the form
3. Add or remove external references and properties
4. Click "Save Changes" to update the component
5. Changes are automatically reflected in the main view

### Context Menu Options

- **Open Details**: Open the component in a detail window
- **Expand**: Expand to show dependencies (future feature)
- **Collapse**: Collapse dependencies (future feature)
- **Copy ID**: Copy the component's BOM reference to clipboard

### Keyboard Shortcuts

- `Ctrl+O` / `Cmd+O`: Open file
- `Ctrl+S` / `Cmd+S`: Save file
- `Ctrl+Shift+S` / `Cmd+Shift+S`: Save file as
- `+` / `=`: Zoom in
- `-`: Zoom out
- `0`: Reset zoom
- `F`: Fit to screen

## File Format Support

### CycloneDX SBOM

The application supports both JSON and XML formats of CycloneDX SBOM files:

- **JSON**: Standard CycloneDX JSON format
- **XML**: Standard CycloneDX XML format

### Supported Component Types

- Application
- Framework
- Library
- Container
- Operating System
- Device
- Firmware
- File
- Hardware
- Platform
- Service

### Supported License Types

- MIT License
- Apache License 2.0
- GNU General Public License v2.0/3.0
- BSD Licenses
- ISC License
- Mozilla Public License 2.0
- And many more...

## Development

### Project Structure

```
heimdall-viewer/
├── src/
│   ├── main.js              # Main Electron process
│   ├── preload.js           # Preload script for IPC
│   └── renderer/
│       ├── index.html       # Main window HTML
│       ├── styles.css       # Main window styles
│       ├── app.js           # Main window JavaScript
│       ├── detail.html      # Detail window HTML
│       ├── detail-styles.css # Detail window styles
│       └── detail.js        # Detail window JavaScript
├── package.json
└── README.md
```

### Key Technologies

- **Electron**: Cross-platform desktop application framework
- **Konva.js**: 2D canvas library for graphics
- **React**: UI library (via CDN for simplicity)
- **CycloneDX Library**: Official CycloneDX parsing library

### Building and Packaging

The application uses `electron-builder` for creating distributable packages:

```bash
# Development build
npm run pack

# Production build
npm run dist
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [CycloneDX](https://cyclonedx.org/) for the SBOM specification
- [Electron](https://www.electronjs.org/) for the desktop framework
- [Konva.js](https://konvajs.org/) for the canvas graphics library

## Support

For issues and feature requests, please create an issue in the repository.

## Roadmap

- [ ] VEX file support
- [ ] Dependency graph visualization
- [ ] Vulnerability highlighting
- [ ] Export to different formats
- [ ] Search and filter functionality
- [ ] Batch editing capabilities
- [ ] Plugin system for custom visualizations