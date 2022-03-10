import * as cdk from "@aws-cdk/core"
import {Duration, RemovalPolicy} from "@aws-cdk/core"
import {
    Artifacts,
    BuildEnvironmentVariable,
    BuildEnvironmentVariableType,
    BuildSpec,
    ComputeType,
    FileSystemLocation,
    LinuxBuildImage,
    Project,
    Source
} from "@aws-cdk/aws-codebuild";
import { Secret } from "@aws-cdk/aws-secretsmanager";
import {LogGroup, LogRetention, RetentionDays} from "@aws-cdk/aws-logs";
import {Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {FileSystem, PerformanceMode} from "@aws-cdk/aws-efs";
import {Peer, Port, SecurityGroup, Vpc} from "@aws-cdk/aws-ec2";
import {Topic} from "@aws-cdk/aws-sns";
import {EmailSubscription} from "@aws-cdk/aws-sns-subscriptions";
import { BlockPublicAccess, Bucket, BucketEncryption } from "@aws-cdk/aws-s3";

export interface ProjectCicdStackProps extends cdk.StackProps {
    projectName: string,
    githubRepo: string,
    githubOwner: string,
    codeArtifactDomain: string,
    codeArtifactRepository: string,
    notificationEmailAddress?: string,
    vpc: Vpc
}

export class ProjectCicdStack extends cdk.Stack {

    private dashedProjectName: string
    private underScoreProjectName: string
    private buildIamRole: Role

    constructor(scope: cdk.Construct, id: string, props: ProjectCicdStackProps) {
        super(scope, id, props);

        this.dashedProjectName = props.projectName.replace(/\s/, '-')
        this.underScoreProjectName = props.projectName.replace(/\s/, '_')
        let snsNotificationTopic: Topic

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

        if (props.notificationEmailAddress) {
            snsNotificationTopic = new Topic(this, 'buildFailTopic', {
                displayName: `${this.dashedProjectName}BuildFailedTopic`
            })
            snsNotificationTopic.addSubscription(new EmailSubscription(props.notificationEmailAddress))
        }

        this.createBuildIamRole(props)

        const secret = new Secret(this, 'deployment_secrets', { 
            description: "Example secrets for cicd build project",
            removalPolicy: RemovalPolicy.DESTROY,
            secretName: "cicd-secrets",
            generateSecretString: {
                secretStringTemplate: "{}",
                generateStringKey: "KUBE_CONFIG"
            }
        })
        secret.grantRead(this.buildIamRole)

        this.createBuildProjects(props, 'build', './cicd/buildspec.yml', undefined, mvnFileSystem, snsNotificationTopic)
        this.createBuildProjects(props, 'staging-deployment', './cicd/deployspec.yml', {
            'DEPLOYMENT_ENVIRONMENT': {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: 'staging'
            }
        }, mvnFileSystem, snsNotificationTopic)
        this.createBuildProjects(props, 'production-deployment', './cicd/deployspec.yml', {
            'DEPLOYMENT_ENVIRONMENT': {
                type: BuildEnvironmentVariableType.PLAINTEXT,
                value: 'production'
            }
        }, mvnFileSystem, snsNotificationTopic)
    }

    private createBuildIamRole(props: ProjectCicdStackProps) {
        this.buildIamRole = new Role(this, 'buildIamRole', {
            roleName: `${this.dashedProjectName}BuildRole`,
            description: `Provides permissions to build for code build to build${this.dashedProjectName}`,
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
                        })],
                })
            }
        })
    }

    private createBuildProjects(props: ProjectCicdStackProps, prefix: string, buildSpecPath: string, environmentVariables: { [p: string]: BuildEnvironmentVariable }, mvnFileSystem?: FileSystem, snsNotificationTopic?: Topic) {
        const dashedProjectName = props.projectName.replace(/\s/, '-')
        const underScoreProjectName = props.projectName.replace(/\s/, '_')

        const logGroupBuild = LogGroup.fromLogGroupName(this, `${prefix}-log-group`, `${dashedProjectName}-${prefix}-logGroup`)
        new LogRetention(this, `${prefix}-build-log-retention`, {
            logGroupName: logGroupBuild.logGroupName,
            retention: RetentionDays.FIVE_DAYS
        })

        const fileSystemLocations = mvnFileSystem ? [FileSystemLocation.efs({
            identifier: 'mvnHome',
            mountPoint: '/mnt',
            location: `${mvnFileSystem.fileSystemId}.efs.${this.region}.amazonaws.com:/`
        })] : []

        const artifactBucket = new Bucket(this, `${prefix}-pipeline-bucket`, {
            versioned: false,
            bucketName: `${prefix}-${dashedProjectName}`,
            autoDeleteObjects: true,
            encryption: BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY
        });

        const project = new Project(this, `${prefix}-pipeline`, {
            projectName: `${underScoreProjectName}_${prefix.toLowerCase()}`,
            description: `${dashedProjectName} ${prefix} Pipeline`,
            buildSpec: BuildSpec.fromSourceFilename(buildSpecPath),
            source: Source.gitHub({
                webhook: prefix === 'build',
                repo: props.githubRepo,
                owner: props.githubOwner
            }),
             artifacts: Artifacts.s3({
                  bucket: artifactBucket,
                  includeBuildId: true,
                  packageZip: false,
                }),
            role: this.buildIamRole,
            environmentVariables,
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
            fileSystemLocations,
            vpc: props.vpc,
            subnetSelection: {subnets: [props.vpc.privateSubnets[0]]},
            timeout: Duration.minutes(20),
            queuedTimeout: Duration.minutes(10),
            grantReportGroupPermissions: true
        })

        if (props.notificationEmailAddress) {
            project.notifyOnBuildFailed(`triggerFailedBuild${prefix}`, snsNotificationTopic)
        }
    }
}
