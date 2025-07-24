# Copyright 2025 The Heimdall Authors.

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#    http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


#!/bin/bash

# Heimdall Viewer Installation Script
# This script installs the Heimdall Viewer application on Linux systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Heimdall Viewer"
APP_VERSION="1.0.0"
INSTALL_DIR="/opt/heimdall-viewer"
DESKTOP_FILE="/usr/share/applications/heimdall-viewer.desktop"
BINARY_NAME="heimdall-viewer"

echo -e "${BLUE}=== Heimdall Viewer Installation ===${NC}"
echo -e "${BLUE}Version: ${APP_VERSION}${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}Error: This script should not be run as root${NC}"
   echo "Please run without sudo and the script will prompt for password when needed"
   exit 1
fi

# Check if the binary exists
if [[ ! -f "dist/linux-unpacked/${BINARY_NAME}" ]]; then
    echo -e "${RED}Error: Binary not found at dist/linux-unpacked/${BINARY_NAME}${NC}"
    echo "Please run 'npm run build' first to create the executable"
    exit 1
fi

# Create installation directory
echo -e "${YELLOW}Creating installation directory...${NC}"
sudo mkdir -p "${INSTALL_DIR}"

# Copy application files
echo -e "${YELLOW}Copying application files...${NC}"
sudo cp -r dist/linux-unpacked/* "${INSTALL_DIR}/"

# Create desktop entry
echo -e "${YELLOW}Creating desktop entry...${NC}"
cat > /tmp/heimdall-viewer.desktop << EOF
[Desktop Entry]
Name=Heimdall Viewer
Comment=A graphical viewer for CycloneDX SBOM and VEX files
Exec=${INSTALL_DIR}/${BINARY_NAME}
Icon=${INSTALL_DIR}/resources/app/assets/icon.png
Terminal=false
Type=Application
Categories=Development;Security;
Keywords=SBOM;VEX;CycloneDX;Security;Vulnerability;
EOF

sudo cp /tmp/heimdall-viewer.desktop "${DESKTOP_FILE}"
rm /tmp/heimdall-viewer.desktop

# Update desktop database
echo -e "${YELLOW}Updating desktop database...${NC}"
sudo update-desktop-database /usr/share/applications

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
sudo chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
sudo chown -R root:root "${INSTALL_DIR}"

# Create symlink in /usr/local/bin (optional)
echo -e "${YELLOW}Creating symlink...${NC}"
sudo ln -sf "${INSTALL_DIR}/${BINARY_NAME}" "/usr/local/bin/${BINARY_NAME}"

echo ""
echo -e "${GREEN}=== Installation Complete! ===${NC}"
echo ""
echo -e "${GREEN}Heimdall Viewer has been installed successfully!${NC}"
echo ""
echo -e "${BLUE}Installation details:${NC}"
echo -e "  Application: ${INSTALL_DIR}/${BINARY_NAME}"
echo -e "  Desktop entry: ${DESKTOP_FILE}"
echo -e "  Command line: ${BINARY_NAME}"
echo ""
echo -e "${BLUE}You can now:${NC}"
echo -e "  • Launch from your application menu"
echo -e "  • Run '${BINARY_NAME}' from the command line"
echo -e "  • Double-click the desktop icon"
echo ""
echo -e "${YELLOW}To uninstall, run: sudo rm -rf ${INSTALL_DIR} ${DESKTOP_FILE} /usr/local/bin/${BINARY_NAME}${NC}" 