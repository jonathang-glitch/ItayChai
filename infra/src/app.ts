import * as cdk from 'aws-cdk-lib';
import { StagingStack } from './staging-stack.js';

const app = new cdk.App();

new StagingStack(app, 'ItayChaiDev', {
  stage: 'dev',
  env: { region: 'il-central-1' },
});

new StagingStack(app, 'ItayChaiStaging', {
  stage: 'staging',
  env: { region: 'il-central-1' },
});
