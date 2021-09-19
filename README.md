# To Deploy

Ensure aws-cdk is installed and bootstrapped. It is important that the aws-cdk cli version matches the cdk dependencies
defined in the `package.json` file. 

In the `cdk bootstrap` phase a S3 bucket is created that will hold the created Cloud Formation templates. 

```bash
$ npm install -g aws-cdk
$ cdk bootstrap
```

The following environment parameters must be set: 


| Name | Description | Example Value |
|---|---|---|
|PROJECT_NAME| The name of the project do provision| cicdProject |
|NOTIFICATION_EMAIL| An email address to which a notification about a failed build will be send. The variable is only required if `PROJECT_NAME` is set to `cicdProject` | john@doe.com |

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
