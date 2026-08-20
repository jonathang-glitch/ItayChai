import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import type { Construct } from 'constructs';

type StagingStackProps = cdk.StackProps & {
  stage: 'dev' | 'staging';
};

export class StagingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StagingStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2, natGateways: 1 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'Note', {
      value: 'Postgres is Supabase. Add ECS services for api, worker, and outbox-relay after images exist.',
    });
  }
}
