import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {BitbucketWebhook} from "./bitbucket-webhook.interface";
import {CloudFormationClient, CreateStackCommand, DeleteStackCommand} from "@aws-sdk/client-cloudformation";
import * as fs from "fs";
import * as util from "util";

export const main = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    if (event.headers['X-Event-Key'] === 'repo:push') {
        const push: BitbucketWebhook = JSON.parse(event.body)
        const cloudFormationClient: CloudFormationClient = new CloudFormationClient({
            region: process.env.AWS_REGION
        })

        for (let change of push.push.changes) {
            if (change.old === null) {
                const name = `${push.repository.name}-${change.new.name}`
                console.info(`Creating new pipeline ${name}`)
                console.info(`Create Event Info: ${JSON.stringify(event.body)}`)

                const cloudFormationTemplate: Buffer = await util.promisify(fs.readFile)(`./codepipeline.template.yaml`)

                await cloudFormationClient.send(new CreateStackCommand({
                    StackName: name,
                    TemplateBody: cloudFormationTemplate.toString(),
                    TimeoutInMinutes: 10,
                    RoleARN: process.env.CLOUD_FORMATION_ROLE_ARN,
                    Parameters: [
                        {
                            ParameterKey: 'S3BucketArtifactStoreParameter',
                            ParameterValue: process.env.S3_BUCKET_ARTIFACT_STORE
                        },
                        {
                            ParameterKey: 'PipelineRoleArnParameter',
                            ParameterValue: process.env.PIPELINE_ROLE_ARN
                        },
                        {
                            ParameterKey: 'GitRepoNameParameter',
                            ParameterValue: push.repository.name
                        },
                        {
                            ParameterKey: 'GitBranchParameter',
                            ParameterValue: change.new.name
                        },
                        {
                            ParameterKey: 'ConnectionArnParameter',
                            ParameterValue: process.env.CONNECTION_ARN
                        },
                        {
                            ParameterKey: 'RepositoryIdParameter',
                            ParameterValue: push.repository.full_name
                        },
                        {
                            ParameterKey: 'CodeBuildProjectNameParameter',
                            ParameterValue: process.env.BUILD_PROJECT_NAME
                        },
                        {
                            ParameterKey: 'DeploymentProjectNameParameter',
                            ParameterValue: process.env.DEPLOYMENT_PROJECT_NAME
                        }
                    ]
                }))
            } else if (change.new === null) {
                const name = `${push.repository.name}-${change.old.name}`

                console.info(`Deleting pipeline ${name}`)
                console.info(`Delete Event Info: ${JSON.stringify(event.body)}`)

                await cloudFormationClient.send(new DeleteStackCommand({
                    RoleARN: process.env.CLOUD_FORMATION_ROLE_ARN,
                    StackName: name
                }))
            } else {
                console.warn(`Unknown event body: ${JSON.stringify(event.body)}`)
            }
        }
    } else {
        console.warn(`Event is not a push notification and cannot be handled: ${JSON.stringify(event.body)}`)
    }

    return {
        statusCode: 200,
        isBase64Encoded: false,
        body: 'Received Webhook'
    }
}
