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

# Heimdall Viewer Uninstallation Script
# This script removes the Heimdall Viewer application from Linux systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/heimdall-viewer"
DESKTOP_FILE="/usr/share/applications/heimdall-viewer.desktop"
BINARY_NAME="heimdall-viewer"

echo -e "${BLUE}=== Heimdall Viewer Uninstallation ===${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}Error: This script should not be run as root${NC}"
   echo "Please run without sudo and the script will prompt for password when needed"
   exit 1
fi

# Confirm uninstallation
echo -e "${YELLOW}This will remove Heimdall Viewer from your system.${NC}"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    exit 0
fi

# Remove application files
if [[ -d "${INSTALL_DIR}" ]]; then
    echo -e "${YELLOW}Removing application files...${NC}"
    sudo rm -rf "${INSTALL_DIR}"
else
    echo -e "${YELLOW}Application directory not found.${NC}"
fi

# Remove desktop entry
if [[ -f "${DESKTOP_FILE}" ]]; then
    echo -e "${YELLOW}Removing desktop entry...${NC}"
    sudo rm -f "${DESKTOP_FILE}"
else
    echo -e "${YELLOW}Desktop entry not found.${NC}"
fi

# Remove symlink
if [[ -L "/usr/local/bin/${BINARY_NAME}" ]]; then
    echo -e "${YELLOW}Removing symlink...${NC}"
    sudo rm -f "/usr/local/bin/${BINARY_NAME}"
else
    echo -e "${YELLOW}Symlink not found.${NC}"
fi

# Update desktop database
echo -e "${YELLOW}Updating desktop database...${NC}"
sudo update-desktop-database /usr/share/applications

echo ""
echo -e "${GREEN}=== Uninstallation Complete! ===${NC}"
echo ""
echo -e "${GREEN}Heimdall Viewer has been removed from your system.${NC}"
echo ""
echo -e "${BLUE}Removed:${NC}"
echo -e "  • Application files: ${INSTALL_DIR}"
echo -e "  • Desktop entry: ${DESKTOP_FILE}"
echo -e "  • Command line symlink: /usr/local/bin/${BINARY_NAME}" 