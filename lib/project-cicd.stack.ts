import * as cdk from "@aws-cdk/core"
import {Duration} from "@aws-cdk/core"
import * as codecommit from '@aws-cdk/aws-codecommit'
import {
    ApprovalRuleTemplate,
    ApprovalRuleTemplateRepositoryAssociation
} from "@cloudcomponents/cdk-pull-request-approval-rule";
import {BuildSpec, ComputeType, FileSystemLocation, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {LogGroup, LogRetention, RetentionDays} from "@aws-cdk/aws-logs";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, CodeCommitSourceAction, CodeCommitTrigger} from "@aws-cdk/aws-codepipeline-actions";
import {Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {FileSystem, PerformanceMode} from "@aws-cdk/aws-efs";
import {Peer, Port, SecurityGroup, Vpc} from "@aws-cdk/aws-ec2";

export interface ProjectCicdStackProps extends cdk.StackProps {
    projectName: string,
    codeArtifactDomain: string,
    codeArtifactRepository: string,
    vpc: Vpc
}

export class ProjectCicdStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: ProjectCicdStackProps) {
        super(scope, id, props);

        const dashedProjectName = props.projectName.replace(/\s/, '-')
        const underScoreProjectName = props.projectName.replace(/\s/, '_')

        const repository = new codecommit.Repository(this, 'Repository', {
            repositoryName: dashedProjectName,
            description: 'Repo for Spring JSON Integration.'
        });

        const {approvalRuleTemplateName} = new ApprovalRuleTemplate(
            this,
            'ApprovalRuleTemplate',
            {
                approvalRuleTemplateName: `${dashedProjectName}-template`,
                template: {
                    approvers: {
                        numberOfApprovalsNeeded: 1,
                    },
                },
            },
        );

        new ApprovalRuleTemplateRepositoryAssociation(
            this,
            'ApprovalRuleTemplateRepositoryAssociation',
            {
                approvalRuleTemplateName,
                repository,
            },
        );

        const logGroupBuild = LogGroup.fromLogGroupName(this, 'build-log-group', `${dashedProjectName}-logGroup`)
        new LogRetention(this, 'build-log-retention', {
            logGroupName: logGroupBuild.logGroupName,
            retention: RetentionDays.FIVE_DAYS
        })

        const buildIamRole = new Role(this, 'buildIamRole', {
            roleName: `${dashedProjectName}BuildRole`,
            description: `Provides permissions to build for code build to build${dashedProjectName}`,
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com', {region: this.region}),
            inlinePolicies: {
                getRepoToken: new PolicyDocument({
                    statements: [new PolicyStatement({
                        actions: [
                            'codeartifact:GetAuthorizationToken',
                            'sts:GetServiceBearerToken',
                        ],
                        effect: Effect.ALLOW,
                        resources: ['*']
                    })]
                }),
                repoInteractions: new PolicyDocument({
                    statements: [
                        new PolicyStatement(
                            {
                                actions: [
                                    'codeartifact:PublishPackageVersion',
                                    'codeartifact:PutPackageMetadata',
                                    'codeartifact:ReadFromRepository'
                                ],
                                effect: Effect.ALLOW,
                                resources: [`arn:aws:codeartifact:${this.region}:${this.account}:repository/${props.codeArtifactDomain}/${props.codeArtifactRepository}/*`]
                            }
                        ),
                        new PolicyStatement({
                            actions: [
                                'codeartifact:ReadFromRepository',
                                'codeartifact:GetRepositoryEndpoint'
                            ],
                            effect: Effect.ALLOW,
                            resources: [`arn:aws:codeartifact:${this.region}:${this.account}:repository/${props.codeArtifactDomain}/${props.codeArtifactRepository}`]
                        })]
                })
            }
        })

        const mvnSecurityGroup = new SecurityGroup(this, 'efsSecurityGroup', {
            vpc: props.vpc,
            description: 'Provides network rules for mvn EFS',
            allowAllOutbound: true,
            securityGroupName: 'mvnEFS'
        })
        mvnSecurityGroup.addIngressRule(Peer.ipv4(props.vpc.vpcCidrBlock), Port.tcp(2049), 'Allow NFS access')

        const mvnFileSystem = new FileSystem(this, 'mvnFileSystem', {
            fileSystemName: 'mvnFilesystem',
            enableAutomaticBackups: false,
            encrypted: false,
            vpc: props.vpc,
            performanceMode: PerformanceMode.GENERAL_PURPOSE,
            vpcSubnets: {subnets: [props.vpc.privateSubnets[0]]},
            securityGroup: mvnSecurityGroup
        })

        const codebuildPipeline = new PipelineProject(this, 'build-pipeline', {
            projectName: `${underScoreProjectName}_build`,
            description: `${dashedProjectName} Build Pipeline`,
            buildSpec: BuildSpec.fromSourceFilename('./cicd/buildspec.yml'),
            role: buildIamRole,
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
                privileged: true,
                computeType: ComputeType.SMALL
            },
            logging: {
                cloudWatch: {
                    enabled: true,
                    prefix: `${dashedProjectName}`,
                    logGroup: logGroupBuild
                }
            },
            fileSystemLocations: [FileSystemLocation.efs({
                identifier: 'mvnHome',
                mountPoint: '/mnt',
                location: `${mvnFileSystem.fileSystemId}.efs.${this.region}.amazonaws.com:/`
            })],
            vpc: props.vpc,
            subnetSelection: {subnets: [props.vpc.privateSubnets[0]]},
            timeout: Duration.minutes(20),
            queuedTimeout: Duration.minutes(10),
        })

        const sourceAction = new CodeCommitSourceAction({
            actionName: 'Git-Checkout',
            repository: repository,
            trigger: CodeCommitTrigger.EVENTS,
            output: new Artifact('sourceCode')
        })

        new Pipeline(this, 'code-pipeline', {
            crossAccountKeys: false,
            pipelineName: `${underScoreProjectName}_pipeline`,
            restartExecutionOnUpdate: false,
            stages: [
                {
                    stageName: 'git-checkout',
                    actions: [sourceAction]
                },
                {
                    stageName: 'build',
                    actions: [new CodeBuildAction({
                        actionName: 'build',
                        project: codebuildPipeline,
                        input: sourceAction.actionProperties.outputs[0]
                    })]
                }]
        })
    }
}
