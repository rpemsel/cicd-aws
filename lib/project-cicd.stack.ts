import * as cdk from "@aws-cdk/core"
import {Duration} from "@aws-cdk/core"
import {BuildSpec, ComputeType, FileSystemLocation, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {LogGroup, LogRetention, RetentionDays} from "@aws-cdk/aws-logs";
import {Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {FileSystem, PerformanceMode} from "@aws-cdk/aws-efs";
import {Peer, Port, SecurityGroup, Vpc} from "@aws-cdk/aws-ec2";
import {NodejsFunction} from "@aws-cdk/aws-lambda-nodejs";
import {LambdaRestApi} from "@aws-cdk/aws-apigateway";
import * as path from "path";
import {CfnConnection} from "@aws-cdk/aws-codestarconnections";
import {Bucket} from "@aws-cdk/aws-s3";

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

        const artifactBucket = new Bucket(this, 'artifactBucket', {})

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
                                    'codeartifact:DescribePackageVersion',
                                    'codeartifact:GetPackageVersionAsset',
                                    'codeartifact:GetPackageVersionReadme',
                                    'codeartifact:ListPackageVersionAssets',
                                    'codeartifact:ListPackageVersionDependencies',
                                    'codeartifact:ListPackageVersions',
                                    'codeartifact:PublishPackageVersion',
                                    'codeartifact:PutPackageMetadata',
                                    'codeartifact:UpdatePackageVersionsStatus'
                                ],
                                effect: Effect.ALLOW,
                                resources: [`arn:aws:codeartifact:${this.region}:${this.account}:package/${props.codeArtifactDomain}/${props.codeArtifactRepository}/*`]
                            }
                        ),
                        new PolicyStatement({
                            actions: [
                                'codeartifact:ReadFromRepository',
                                'codeartifact:GetRepositoryEndpoint'
                            ],
                            effect: Effect.ALLOW,
                            resources: [`arn:aws:codeartifact:${this.region}:${this.account}:repository/${props.codeArtifactDomain}/${props.codeArtifactRepository}`]
                        }),
                        new PolicyStatement({
                            actions: [
                                's3:ListBucket'
                            ],
                            effect: Effect.ALLOW,
                            resources: [artifactBucket.bucketArn]
                        }),
                        new PolicyStatement({
                            actions: [
                                's3:*Object*',
                            ],
                            effect: Effect.ALLOW,
                            resources: [`${artifactBucket.bucketArn}/*`]
                        })],
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

        const bitbucketConnection = new CfnConnection(this, 'bitbucketConnection', {
            connectionName: `${dashedProjectName}`,
            providerType: 'Bitbucket'
        })

        const buildPipelineRole = new Role(this, 'pipelineIamRole', {
            roleName: `CodePipelineRole`,
            description: `Provides permissions for running code pipelines`,
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
            inlinePolicies: {
                codestarConnectionPolicy: new PolicyDocument({
                    statements: [new PolicyStatement({
                        actions: [
                            'codestar-connections:GetConnection',
                            'codestar-connections:UseConnection',
                            'codestar-connections:PassConnection'
                        ],
                        resources: [
                            bitbucketConnection.attrConnectionArn
                        ],

                    })]
                })
            },
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AWSCodePipelineFullAccess'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSCodeCommitFullAccess'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildDeveloperAccess'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess')],
            path: '/'
        })

        const pipelineCreationLambdaRole = new Role(this, 'pipelineCreationLambdaRole', {
            roleName: `PipelineCreationLambdaRole`,
            description: `Provides permissions for creating a code pipeline`,
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies: {
                codestarConnectionPolicy: new PolicyDocument({
                    statements: [new PolicyStatement({
                        actions: [
                            'codestar-connections:GetConnection',
                            'codestar-connections:ListConnections',
                            'codestar-connections:PassConnection'
                        ],
                        resources: [
                            bitbucketConnection.attrConnectionArn
                        ],

                    })]
                })
            },
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSCodePipelineFullAccess'),
                ManagedPolicy.fromManagedPolicyArn(this, 'AWSLambdaBasicExecutionRole', 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole')],
            path: '/'
        })


        const pipelineCreationLambda = new NodejsFunction(this, 'pipelineCreationLambda', {
            functionName: 'PipelineCreation',
            description: 'Creates CodePipelines if new git branches are created',
            role: pipelineCreationLambdaRole,
            awsSdkConnectionReuse: true,
            environment: {
                CONNECTION_ARN: bitbucketConnection.attrConnectionArn,
                PIPELINE_ROLE_ARN: buildPipelineRole.roleArn,
                S3_BUCKET_ARTIFACT_STORE: artifactBucket.bucketName,
                BUILD_PROJECT_NAME: codebuildPipeline.projectName
            },
            entry: path.join(__dirname, '../resources/pipeline-creation-lambda/index.ts'),
            handler: 'main',
            bundling: {
                minify: true,
                externalModules: ['aws-sdk'],
                forceDockerBundling: true,
                commandHooks: {
                    beforeInstall(inputDir: string, outputDir: string): string[] {
                        return []
                    },
                    beforeBundling(inputDir: string, outputDir: string): string[] {
                        return []
                    },
                    afterBundling(inputDir: string, outputDir: string): string[] {
                        return [`cp ${inputDir}/resources/pipeline-creation-lambda/cloudformation/codepipeline.template.yaml ${outputDir}`];
                    }
                }
            },
            logRetention: RetentionDays.FIVE_DAYS,
            timeout: Duration.minutes(3)
        })

        const lambdaApiGateway = new LambdaRestApi(this, 'webhookApi', {
            restApiName: 'WebhookApi',
            handler: pipelineCreationLambda,
            deploy: true
        })
    }
}
