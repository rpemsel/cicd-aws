import * as cdk from "@aws-cdk/core"
import {SecretValue, StackProps} from "@aws-cdk/core";
import {Group, ManagedPolicy, User} from "@aws-cdk/aws-iam";


export class ExampleUserStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id, props);

       const developerGroup = new Group(this, 'developerGroup', {
           groupName: 'Developers',
           managedPolicies: [
               ManagedPolicy.fromAwsManagedPolicyName('AWSCodeCommitReadOnly')
           ]
       })


       const user = new User(this, 'exampleUser', {
           userName: 'developerOne',
           password: new SecretValue('Test1234!'),
           passwordResetRequired: false,
           groups: [developerGroup]
       })
    }
}
