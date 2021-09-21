import * as cdk from "@aws-cdk/core";
import {StackProps} from "@aws-cdk/core";
import {CfnDomain, CfnRepository} from "@aws-cdk/aws-codeartifact";

export class ArtifactRepoStack extends cdk.Stack {

    private _repoName: string = 'artifact-repo'
    private _domainName: string = 'artifact-repo'

    constructor(scope: cdk.Construct, id: string, props: StackProps) {
        super(scope, id, props);

        const cfnDomain = new CfnDomain(this, 'codeArtifactDomain', {
            domainName: this._domainName
        })

        new CfnRepository(this, 'codeArtifactRepo', {
            repositoryName: this._repoName,
            domainName: cfnDomain.domainName,
            externalConnections: ['public:maven-central'],
            domainOwner: this.account
        }).addDependsOn(cfnDomain)
    }


    get repoName(): string {
        return this._repoName;
    }

    get domainName(): string {
        return this._domainName;
    }
}
