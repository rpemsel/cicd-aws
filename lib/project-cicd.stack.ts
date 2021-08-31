import * as cdk from "@aws-cdk/core"
import * as codecommit from '@aws-cdk/aws-codecommit'
import {
    ApprovalRuleTemplate,
    ApprovalRuleTemplateRepositoryAssociation
} from "@cloudcomponents/cdk-pull-request-approval-rule";

export interface ProjectCicdStackProps extends cdk.StackProps {
    projectName: string
}

export class ProjectCicdStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: ProjectCicdStackProps) {
        super(scope, id, props);

        const dashedProjectName = props.projectName.replace(/\s/, '-')

        const repository = new codecommit.Repository(this, 'Repository' ,{
            repositoryName: dashedProjectName,
            description: 'Repo for Spring JSON Integration.',
        });

        const { approvalRuleTemplateName } = new ApprovalRuleTemplate(
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
    }
}
