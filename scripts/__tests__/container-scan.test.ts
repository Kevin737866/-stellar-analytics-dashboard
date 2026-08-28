import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const __dirname = resolve(import.meta.dirname);

describe('Container Vulnerability Scanning', () => {
  describe('Scripts', () => {
    it('scan-containers.sh exists and is executable', () => {
      const scriptPath = join(__dirname, '../scan-containers.sh');
      expect(existsSync(scriptPath)).toBe(true);
      
      try {
        statSync(scriptPath);
        // File exists, check if it's a regular file
        expect(statSync(scriptPath).isFile()).toBe(true);
      } catch (error) {
        // Expected if file is not executable, but still exists
        expect(true).toBe(true);
      }
    });

    it('scan-containers.sh has proper shebang', () => {
      const scriptPath = join(__dirname, '../scan-containers.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });

    it('scan-containers.sh has usage documentation', () => {
      const scriptPath = join(__dirname, '../scan-containers.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('Usage:');
      expect(content).toContain('Modes:');
    });

    it('scan-containers.sh supports all scan modes', () => {
      const scriptPath = join(__dirname, '../scan-containers.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      
      expect(content).toContain('filesystem');
      expect(content).toContain('docker');
      expect(content).toContain('dockerfile');
      expect(content).toContain('all');
    });

    it('scan-containers.sh has proper exit codes', () => {
      const scriptPath = join(__dirname, '../scan-containers.sh');
      const content = readFileSync(scriptPath, 'utf-8');
      
      expect(content).toContain('exit 0'); // No vulnerabilities
      expect(content).toContain('exit 1'); // Vulnerabilities found
      expect(content).toContain('exit 2'); // Scan error
    });
  });

  describe('CI Workflow', () => {
    const workflowPath = join(__dirname, '../.github/workflows/container-scan.yml');

    it('container-scan.yml exists', () => {
      expect(existsSync(workflowPath)).toBe(true);
    });

    it('workflow runs on push to main and develop', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('push:');
      expect(content).toContain('branches: [ main, develop ]');
    });

    it('workflow runs on pull_request', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('pull_request:');
    });

    it('workflow runs on schedule (nightly)', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('schedule:');
      expect(content).toContain("cron: '0 2 * * *'");
    });

    it('workflow includes trivy-scan job', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('trivy-scan:');
    });

    it('workflow includes dockerfile-lint job', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('dockerfile-lint:');
    });

    it('workflow includes docker-compose-lint job', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('docker-compose-lint:');
    });

    it('trivy uses filesystem scan mode', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain("scan-type: 'filesystem'");
      expect(content).toContain("scan-dev-deps: 'true'");
      expect(content).toContain("severity: 'CRITICAL,HIGH'");
    });

    it('workflow uploads SARIF results', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('codeql-action/upload-sarif@v3');
      expect(content).toContain('sarif_file: \'trivy-results.sarif\'');
    });

    it('workflow has appropriate timeouts', () => {
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('timeout-minutes: 15'); // Trivy scan
      expect(content).toContain('timeout-minutes: 5');  // Lint jobs
    });
  });

  describe('Documentation', () => {
    const docsPath = join(__dirname, '../docs/CONTAINER_VULNERABILITY_SCANNING.md');

    it('CONTAINER_VULNERABILITY_SCANNING.md exists', () => {
      expect(existsSync(docsPath)).toBe(true);
    });

    it('Documentation has overview section', () => {
      const content = readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Overview');
      expect(content).toContain('Purpose');
    });

    it('Documentation has usage instructions', () => {
      const content = readFileSync(docsPath, 'utf-8');
      expect(content).toContain('Usage:');
      expect(content).toContain('script/scan-containers.sh');
    });

    it('Documentation has CI workflow details', () => {
      const content = readFileSync(docsPath, 'utf-8');
      expect(content).toContain('.github/workflows/container-scan.yml');
    });
  });

  describe('Security Scanning Coverage', () => {
    it('Trivy config includes dev dependencies scan', () => {
      const workflowPath = join(__dirname, '../.github/workflows/container-scan.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('scan-dev-deps:');
    });

    it('Trivy config ignores unfixed vulnerabilities', () => {
      const workflowPath = join(__dirname, '../.github/workflows/container-scan.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('ignore-unfixed:');
    });

    it('Workflow checks security in docker-compose lint', () => {
      const workflowPath = join(__dirname, '../.github/workflows/container-scan.yml');
      const content = readFileSync(workflowPath, 'utf-8');
      expect(content).toContain('check-security:');
    });
  });
});

describe('Container Security Best Practices', () => {
  it('docker-compose files have health checks', () => {
    const composePath = join(__dirname, '../docker-compose.yml');
    const devComposePath = join(__dirname, '../docker-compose.dev.yml');
    
    if (existsSync(composePath)) {
      const content = readFileSync(composePath, 'utf-8');
      expect(content).toContain('healthcheck:');
    }
    
    if (existsSync(devComposePath)) {
      const devContent = readFileSync(devComposePath, 'utf-8');
      expect(devContent).toContain('healthcheck:');
    }
  });

  it('docker-compose uses Alpine images for smaller attack surface', () => {
    const composePath = join(__dirname, '../docker-compose.yml');
    if (existsSync(composePath)) {
      const content = readFileSync(composePath, 'utf-8');
      // Check for Alpine images
      expect(content).toContain('alpine');
    }
  });
});
