import * as cdk from '@aws-cdk/core';
import {ProjectCicdStack} from "../lib/project-cicd.stack";
import {ExampleUserStack} from "../lib/example-user.stack";
import {ArtifactRepoStack} from "../lib/artifact-repo.stack";

const app = new cdk.App();
const exampleUserStack = new ExampleUserStack(app, 'exampleUserStack', {})
const codeCommitStack = new ProjectCicdStack(app, 'cicdStack', { projectName: process.env.PROJECT_NAME || '' })
const artifactStack = new ArtifactRepoStack(app, 'artifactRepoStack', {})

