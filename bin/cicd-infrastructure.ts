import * as cdk from '@aws-cdk/core';
import {ProjectCicdStack} from "../lib/project-cicd.stack";
import {ArtifactRepoStack} from "../lib/artifact-repo.stack";
import {VpcStack} from "../lib/vpc.stack";

const app = new cdk.App();
const vpcStack = new VpcStack(app, 'vpcStack', {
    cidrRange: '10.0.0.0/21',
    env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
    },
})
const artifactStack = new ArtifactRepoStack(app, 'artifactRepoStack', {})
const cicdStack = new ProjectCicdStack(app, 'cicdStack', {
    projectName: process.env.PROJECT_NAME || 'integration',
    codeArtifactDomain: artifactStack.domainName,
    codeArtifactRepository: artifactStack.repoName,
    vpc: vpcStack.vpc,
    env: {
        region: process.env.CDK_DEFAULT_REGION,
        account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    notificationEmailAddress: process.env.NOTIFICATION_EMAIL
})

cicdStack.addDependency(artifactStack, 'Adds a Maven repository')
cicdStack.addDependency(vpcStack, 'Adds network support')

