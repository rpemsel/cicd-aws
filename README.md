# AWS CICD Infrastructure

## Overview

This project demonstrates how a complete CICD infrastructure can be setup using AWS. The 
infrastructure is provisioned using AWS CDK. 

## Included Stacks

The following stacks are included in the project

* **vpcStack**: a stac creating a VPC with private and public subnets that hosts the infrastructure for the CICD platform
* **artifactRepoStack**: An artifact repository in which build Maven artifacts are put into
* **cicdStack**: A stack containing of elements required to provide a CICD platform based on the AWS supplied products. The CICD stack depends on the other stacks included in this repository

## Provision infrastructure

Ensure aws-cdk is installed and bootstrapped. It is important that the aws-cdk cli version matches the cdk dependencies
defined in the `package.json` file. 

In the `cdk bootstrap` phase a S3 bucket is created that will hold the created Cloud Formation templates. 

```bash
$ npm install -g aws-cdk
$ cdk bootstrap
```

The following environment parameters must be set before other commands are run: 


| Name | Description | Example Value |
|---|---|---|
|PROJECT_NAME| The name of the project do provision| cicdProject |
|NOTIFICATION_EMAIL| An email address to which a notification about a failed build will be send. The variable is only required if `PROJECT_NAME` is set to `cicdProject` | john@doe.com |

Before the changes are rolled out, check the generated Cloud Formation Template: 

```bash
$ npm run synth
```

Then build and deploy either the whole application:

```bash
$ npm run deploy
```

or single stacks:

```bash
$ npm run deploy -- cicdStack
```

In the end destroy the stack:

```bash
$ npm run destroy
```
