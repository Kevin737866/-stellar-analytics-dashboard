/**
 * Deployment Smoke Tests Runner
 * 
 * This script runs deployment smoke tests against a deployed instance.
 * It can be run manually or as part of a CI/CD pipeline.
 * 
 * Usage:
 *   ts-node scripts/smoke-test.ts --url <deployment-url>
 *   pnpm --filter @stellar-analytics/e2e run smoke-test --url https://staging.example.com
 */

import { execSync } from 'child_process';
import { parseArgs } from 'util';
import chalk from 'chalk';

interface Options {
  url?: string;
  branch?: string;
  environment?: string;
  verbose?: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', short: 'u' },
      branch: { type: 'string', short: 'b' },
      environment: { type: 'string', short: 'e' },
      verbose: { type: 'boolean', short: 'v' },
    },
    strict: false,
  });

  return {
    url: values.url || process.env.BASE_URL,
    branch: values.branch || process.env.GITHUB_REF_NAME || 'unknown',
    environment: values.environment || process.env.NODE_ENV || 'development',
    verbose: values.verbose || false,
  };
}

function validateOptions(options: Options): void {
  if (!options.url) {
    console.error(chalk.red('Error: BASE_URL is required'));
    console.error('Usage: pnpm --filter @stellar-analytics/e2e run smoke-test --url <deployment-url>');
    console.error('       Or set BASE_URL environment variable');
    process.exit(1);
  }
}

function log(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const timestamp = new Date().toISOString();
  switch (level) {
    case 'success':
      console.log(chalk.green(`[SUCCESS] ${timestamp} - ${message}`));
      break;
    case 'error':
      console.log(chalk.red(`[ERROR] ${timestamp} - ${message}`));
      break;
    case 'warning':
      console.log(chalk.yellow(`[WARNING] ${timestamp} - ${message}`));
      break;
    default:
      console.log(chalk.blue(`[INFO] ${timestamp} - ${message}`));
  }
}

function runPlaywrightTests(url: string, branch: string, environment: string, verbose: boolean): void {
  const env = {
    BASE_URL: url,
    CI: 'true',
    DEPLOYMENT_BRANCH: branch,
    DEPLOYMENT_ENVIRONMENT: environment,
    NODE_ENV: environment,
  };

  const playwrightArgs = [
    'test',
    'smoke/deployment.spec.ts',
    `--project=${environment === 'production' ? 'chromium' : 'chromium'}`,
    '--reporter=list,json',
    `--output=${process.env.CI ? 'test-results/smoke' : 'playwright-smoke-output'}`,
  ];

  if (verbose) {
    playwrightArgs.push('--debug');
  }

  if (process.env.CI) {
    playwrightArgs.push('--reporter=junit', `--junitOutputPath=smoke-test-results.xml`);
  }

  const command = `pnpm exec playwright ${playwrightArgs.join(' ')}`;
  
  log(`Running smoke tests against ${url}`);
  log(`Branch: ${branch}, Environment: ${environment}`);
  log(`Command: ${command}`);

  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    log('Smoke tests completed successfully!', 'success');
  } catch (error) {
    log('Smoke tests failed!', 'error');
    process.exit(1);
  }
}

function main(): void {
  const options = parseOptions();
  validateOptions(options);

  log('🚀 Starting Deployment Smoke Tests', 'info');
  log(`Target: ${options.url}`);
  log(`Branch: ${options.branch}`);
  log(`Environment: ${options.environment}`);

  runPlaywrightTests(options.url, options.branch, options.environment, options.verbose || false);
}

main();
