import * as cdk from "@aws-cdk/core"
import {Duration} from "@aws-cdk/core"
import * as codecommit from '@aws-cdk/aws-codecommit'
import {
    ApprovalRuleTemplate,
    ApprovalRuleTemplateRepositoryAssociation
} from "@cloudcomponents/cdk-pull-request-approval-rule";
import {ComputeType, LinuxBuildImage, PipelineProject} from "@aws-cdk/aws-codebuild";
import {LogGroup, LogRetention, RetentionDays} from "@aws-cdk/aws-logs";
import {Artifact, Pipeline} from "@aws-cdk/aws-codepipeline";
import {CodeBuildAction, CodeCommitSourceAction, CodeCommitTrigger} from "@aws-cdk/aws-codepipeline-actions";

export interface ProjectCicdStackProps extends cdk.StackProps {
    projectName: string
}

export class ProjectCicdStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: ProjectCicdStackProps) {
        super(scope, id, props);

        const dashedProjectName = props.projectName.replace(/\s/, '-')

        const repository = new codecommit.Repository(this, 'Repository', {
            repositoryName: dashedProjectName,
            description: 'Repo for Spring JSON Integration.',
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

        const codebuildPipeline = new PipelineProject(this, 'build-pipeline', {
            projectName: `${dashedProjectName}-build`,
            description: `${dashedProjectName} Build Pipeline`,
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
            pipelineName: `${dashedProjectName}-pipeline`,
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
