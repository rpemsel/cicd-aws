import * as cdk from "@aws-cdk/core";
import { StackProps} from "@aws-cdk/core";
import {CfnDomain, CfnRepository} from "@aws-cdk/aws-codeartifact";

export class ArtifactRepoStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const cfnDomain = new CfnDomain(this, 'codeArtifactDomain', {
            domainName: 'development-artifact-repo'
        })

        new CfnRepository(this, 'codeArtifactRepo', {
            repositoryName:  'development-artifact-repo',
            domainName: cfnDomain.domainName,
            externalConnections: ['public:maven-central'],
            domainOwner: this.account
        })
    }
}
