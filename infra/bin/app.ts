#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { GaravitoStack } from '../lib/garavito-stack';
import { SonarStack } from '../lib/sonar-stack';

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };

// La organizacion de la cuenta solo permite us-east-2 (Ohio).
new GaravitoStack(app, 'OperacionGaravito', { env });

// SonarQube del CI, aparte: se despliega y se apaga sin tocar el juego.
new SonarStack(app, 'OperacionGaravitoSonar', { env });
