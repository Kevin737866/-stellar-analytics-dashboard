#!/bin/bash
#
# Container Vulnerability Scanner
#
# Scans Docker images and filesystem for security vulnerabilities.
# Uses Trivy (https://github.com/aquasecurity/trivy) for scanning.
#
# Usage:
#   ./scripts/scan-containers.sh [mode]
#
# Modes:
#   filesystem  - Scan project files for vulnerabilities (default)
#   docker      - Scan Docker images (requires Docker daemon)
#   all         - Run both modes
#
# Exit codes:
#   0 - No vulnerabilities found
#   1 - Vulnerabilities found
#   2 - Scan error
#

set -euo pipefail

# Configuration
SCAN_SEVERITY="${SCAN_SEVERITY:-CRITICAL,HIGH}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-table}"
SCAN_DIR="${SCAN_DIR:-.}"
OUTPUT_FILE="${OUTPUT_FILE:-trivy-scan-results.txt}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo "================================================"
    echo "$1"
    echo "================================================"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_trivy() {
    if ! command -v trivy &> /dev/null; then
        print_warning "Trivy is not installed. Installing..."
        
        # Install Trivy
        case "$(uname -s)" in
            Linux)
                curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                ;;
            Darwin)
                brew install aquasecurity/trivy/trivy
                ;;
            *)
                print_error "Unsupported platform. Please install Trivy manually: https://aquasecurity.github.io/trivy/getting-started/installation/"
                exit 2
                ;;
        esac
    fi
}

scan_filesystem() {
    print_header "Filesystem Scan"
    
    echo "Scanning project files in ${SCAN_DIR}..."
    echo "Severity threshold: ${SCAN_SEVERITY}"
    echo ""
    
    trivy fs --severity "${SCAN_SEVERITY}" \
        --format "${OUTPUT_FORMAT}" \
        --output "${OUTPUT_FILE}" \
        --scanners vuln,config,secret \
        "${SCAN_DIR}"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "No vulnerabilities found"
        echo ""
        echo "Results saved to: ${OUTPUT_FILE}"
        return 0
    else
        print_error "Vulnerabilities detected"
        echo ""
        echo "Results saved to: ${OUTPUT_FILE}"
        cat "${OUTPUT_FILE}"
        return 1
    fi
}

scan_docker_images() {
    print_header "Docker Image Scan"
    
    # Check if docker-compose.yml exists
    if [ ! -f "docker-compose.yml" ]; then
        print_warning "No docker-compose.yml found, skipping image scan"
        return 0
    fi
    
    # Extract image names from docker-compose.yml
    local images
    images=$(grep -E '^\s*image:' docker-compose.yml | sed 's/.*image:\s*//' | sed 's/["'\'']//g' | sort -u)
    
    if [ -z "$images" ]; then
        print_warning "No Docker images found in docker-compose.yml"
        return 0
    fi
    
    echo "Found images:"
    echo "$images"
    echo ""
    
    local all_passed=true
    
    for image in $images; do
        echo "Scanning image: ${image}"
        echo "-----------------------------------"
        
        if trivy image --severity "${SCAN_SEVERITY}" \
            --format "${OUTPUT_FORMAT}" \
            --quiet \
            "$image" > /dev/null 2>&1; then
            print_success "No vulnerabilities in ${image}"
        else
            print_error "Vulnerabilities found in ${image}"
            echo ""
            trivy image --severity "${SCAN_SEVERITY}" \
                --format "${OUTPUT_FORMAT}" \
                "$image" || true
            all_passed=false
        fi
        echo ""
    done
    
    if [ "$all_passed" = true ]; then
        return 0
    else
        return 1
    fi
}

scan_dockerfiles() {
    print_header "Dockerfile Lint"
    
    # Find all Dockerfiles
    local dockerfiles
    dockerfiles=$(find . -name "Dockerfile*" -type f 2>/dev/null || true)
    
    if [ -z "$dockerfiles" ]; then
        print_warning "No Dockerfiles found"
        return 0
    fi
    
    local all_passed=true
    
    for dockerfile in $dockerfiles; do
        echo "Linting: ${dockerfile}"
        echo "-----------------------------------"
        
        if command -v hadolint &> /dev/null; then
            if hadolint "$dockerfile" > /dev/null 2>&1; then
                print_success "No linting issues in ${dockerfile}"
            else
                print_error "Linting issues found in ${dockerfile}"
                echo ""
                hadolint "$dockerfile" || true
                all_passed=false
            fi
        else
            print_warning "hadolint not installed, skipping linting"
        fi
        echo ""
    done
    
    if [ "$all_passed" = true ]; then
        return 0
    else
        return 1
    fi
}

main() {
    local mode="${1:-filesystem}"
    
    print_header "Container Vulnerability Scanner"
    echo "Mode: ${mode}"
    echo "Severity: ${SCAN_SEVERITY}"
    echo "Output: ${OUTPUT_FILE}"
    echo ""
    
    # Check prerequisites
    check_trivy
    
    local failed=0
    
    case "$mode" in
        filesystem)
            scan_filesystem || failed=1
            ;;
        docker)
            scan_docker_images || failed=1
            ;;
        dockerfile)
            scan_dockerfiles || failed=1
            ;;
        all)
            scan_filesystem || failed=1
            scan_docker_images || failed=1
            scan_dockerfiles || failed=1
            ;;
        *)
            print_error "Unknown mode: ${mode}"
            echo "Valid modes: filesystem, docker, dockerfile, all"
            exit 2
            ;;
    esac
    
    print_header "Scan Complete"
    
    if [ $failed -eq 0 ]; then
        print_success "All scans passed"
        exit 0
    else
        print_error "Some scans failed"
        exit 1
    fi
}

main "$@"
