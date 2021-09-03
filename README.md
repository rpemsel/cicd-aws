# To Deploy

Ensure aws-cdk is installed and bootstrapped. It is important that the aws-cdk cli version matches the cdk dependencies
defined in the `package.json` file. 

In the `cdk bootstrap` phase a S3 bucket is created that will hold the created Cloud Formation templates. 

```bash
$ npm install -g aws-cdk
$ cdk bootstrap
```

Before the changes are rolled out, check the generated Cloud Formation Template: 

```bash
$ PROJECT_NAME=<projectName> cdk synth
```

Then build and deploy either the whole application:

```bash
$ PROJECT_NAME=<projectName> cdk deploy
```

or single stacks:

```bash
$ cdk deploy exampleUserStack
$ cdk deploy artifactRepoStack
```

In the end destroy the stack:

```bash
$ cdk destroy
```
