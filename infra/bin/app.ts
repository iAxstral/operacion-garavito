#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { GaravitoStack } from '../lib/garavito-stack';

const app = new App();

// La organizacion de la cuenta solo permite us-east-2 (Ohio).
new GaravitoStack(app, 'OperacionGaravito', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' },
});
